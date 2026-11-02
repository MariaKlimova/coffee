"""The boolean-to-count migration never fabricates physical inventory."""

from decimal import Decimal

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_existing_products_and_orders_migrate_conservatively():
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [("catalog", "0003_short_description"), ("orders", "0001_initial")]
    executor.migrate(previous)
    try:
        apps = executor.loader.project_state(previous).apps
        Category = apps.get_model("catalog", "Category")
        Product = apps.get_model("catalog", "Product")
        Order = apps.get_model("orders", "Order")
        category = Category.objects.create(name="Legacy", slug="coffee")
        products = [
            Product.objects.create(
                name=f"Legacy {flag}",
                slug=f"legacy-{flag}",
                category=category,
                short_description="Original owner data",
                price=Decimal("500.00"),
                in_stock=flag,
            )
            for flag in [True, False]
        ]
        orders = [
            Order.objects.create(
                delivery_address="Synthetic original address",
                total_amount=Decimal("500.00"),
                status=status,
            )
            for status in ["pending", "paid"]
        ]
        executor = MigrationExecutor(connection)
        executor.migrate(latest)
        apps = executor.loader.project_state(latest).apps
        Product = apps.get_model("catalog", "Product")
        Order = apps.get_model("orders", "Order")
        for original in products:
            migrated = Product.objects.get(pk=original.pk)
            assert (migrated.stock_quantity, migrated.reserved_quantity) == (0, 0)
            assert migrated.name == original.name
            assert migrated.is_published is True
        for original in orders:
            migrated = Order.objects.get(pk=original.pk)
            assert migrated.status == original.status
            assert migrated.reservation_state == "none"
            assert migrated.reservation_expires_at is None
            assert migrated.total_amount == original.total_amount
        # Redeploy/migrate is idempotent and preserves a manually counted value.
        Product.objects.filter(pk=products[0].pk).update(stock_quantity=23)
        MigrationExecutor(connection).migrate(latest)
        assert Product.objects.get(pk=products[0].pk).stock_quantity == 23
    finally:
        MigrationExecutor(connection).migrate(latest)

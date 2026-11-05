"""Workflow audit migration preserves money, inventory and historical statuses."""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_workflow_migration_does_not_invent_legacy_events_or_touch_inventory():
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [
        (app, "0002_stock_reservations" if app == "orders" else name)
        for app, name in latest
    ]
    executor.migrate(previous)
    try:
        apps = executor.loader.project_state(previous).apps
        Category = apps.get_model("catalog", "Category")
        Product = apps.get_model("catalog", "Product")
        Order = apps.get_model("orders", "Order")
        category = Category.objects.create(name="Legacy workflow", slug="workflow")
        product = Product.objects.create(
            category=category,
            name="Kept",
            slug="kept",
            short_description="Kept",
            price="7.00",
            stock_quantity=17,
            reserved_quantity=3,
        )
        order = Order.objects.create(
            status="paid",
            total_amount="14.00",
            delivery_address="Synthetic kept",
            reservation_state="none",
        )
        # Inspect the unchanged money row using the normal current model.
        from apps.payments.models import Payment as CurrentPayment

        payment = CurrentPayment.objects.create(
            order_id=order.pk,
            amount="14.00",
            status="succeeded",
            provider_payment_id="migration-synthetic",
            raw_payload={"synthetic": True},
        )
        money_before = list(CurrentPayment.objects.filter(pk=payment.pk).values())
        executor = MigrationExecutor(connection)
        executor.migrate(latest)
        apps = executor.loader.project_state(latest).apps
        migrated = apps.get_model("orders", "Order").objects.get(pk=order.pk)
        kept = apps.get_model("catalog", "Product").objects.get(pk=product.pk)
        assert migrated.status == "paid" and migrated.reservation_state == "none"
        assert (
            str(migrated.total_amount) == "14.00"
            and migrated.delivery_address == "Synthetic kept"
        )
        assert (kept.stock_quantity, kept.reserved_quantity) == (17, 3)
        assert apps.get_model("orders", "OrderStatusTransition").objects.count() == 0
        assert (
            list(CurrentPayment.objects.filter(pk=payment.pk).values()) == money_before
        )
        MigrationExecutor(connection).migrate(latest)
        assert apps.get_model("orders", "OrderStatusTransition").objects.count() == 0
    finally:
        MigrationExecutor(connection).migrate(latest)

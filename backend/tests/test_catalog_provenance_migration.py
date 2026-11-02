"""The historical demo migration uses created UUIDs, never matching slugs."""

import importlib
from decimal import Decimal
from uuid import uuid4

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_demo_migration_marks_exact_created_ids_and_preserves_existing_owner():
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [("catalog", "0004_inventory")]
    executor.migrate(previous)
    try:
        apps = executor.loader.project_state(previous).apps
        Category = apps.get_model("catalog", "Category")
        Product = apps.get_model("catalog", "Product")
        Image = apps.get_model("catalog", "ProductImage")
        category = Category.objects.create(name="Coffee", slug="coffee")
        migration = importlib.import_module(
            "apps.catalog.migrations.0006_import_demo_provenance"
        )
        demo_id = migration.DEMO_IDS[0]
        demo = Product.objects.create(
            pk=demo_id,
            name="Edited historical demo",
            slug="edited-demo",
            category=category,
            short_description="Keep all data",
            price=Decimal("700.00"),
            stock_quantity=17,
            reserved_quantity=2,
        )
        owner = Product.objects.create(
            pk=uuid4(),
            name="Owner",
            slug="ethiopia-yirgacheffe",
            category=category,
            short_description="Existing matching slug is not demo",
            price=Decimal("750.00"),
            stock_quantity=9,
        )
        image = Image.objects.create(
            product=demo, image="owner-upload.png", is_main=True
        )
        executor = MigrationExecutor(connection)
        executor.migrate(latest)
        apps = executor.loader.project_state(latest).apps
        Product = apps.get_model("catalog", "Product")
        Image = apps.get_model("catalog", "ProductImage")
        migrated = Product.objects.get(pk=demo.pk)
        assert migrated.origin == "demo"
        assert migrated.demo_source == "catalog-data-20261101T123258089703Z"
        assert (migrated.stock_quantity, migrated.reserved_quantity) == (17, 2)
        assert migrated.slug == "edited-demo"
        assert Product.objects.get(pk=owner.pk).origin == "owner"
        assert Image.objects.get(pk=image.pk).is_mock is False
        assert apps.get_model("catalog", "CatalogState").objects.get(pk=1).demo_enabled
        Product.objects.filter(pk=demo.pk).update(origin="owner")
        MigrationExecutor(connection).migrate(latest)
        assert Product.objects.get(pk=demo.pk).origin == "owner"
    finally:
        MigrationExecutor(connection).migrate(latest)

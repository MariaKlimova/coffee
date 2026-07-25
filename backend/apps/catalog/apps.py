"""Django app config for the product catalog."""

from django.apps import AppConfig


class CatalogConfig(AppConfig):
    """Registers the catalog application (categories, products, images)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.catalog"
    label = "catalog"
    verbose_name = "Catalog"

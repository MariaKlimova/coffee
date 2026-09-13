"""Django app config for orders."""

from django.apps import AppConfig


class OrdersConfig(AppConfig):
    """Registers the orders application (checkout from cart)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.orders"
    label = "orders"
    verbose_name = "Orders"

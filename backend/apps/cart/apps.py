"""Django app config for shopping cart."""

from django.apps import AppConfig


class CartConfig(AppConfig):
    """Registers the cart application (guest + authenticated baskets)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.cart"
    label = "cart"
    verbose_name = "Cart"

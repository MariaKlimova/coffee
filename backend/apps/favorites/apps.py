"""Django app config for user favorites."""

from django.apps import AppConfig


class FavoritesConfig(AppConfig):
    """Registers the favorites application (user ↔ product wishlist)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.favorites"
    label = "favorites"
    verbose_name = "Favorites"

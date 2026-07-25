"""Django app config for users."""

from django.apps import AppConfig


class UsersConfig(AppConfig):
    """Registers the users application."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.users"
    label = "users"
    verbose_name = "Users"

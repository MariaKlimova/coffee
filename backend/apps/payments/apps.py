"""Django app config for payments."""

from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    """Registers the payments application (YooKassa create + webhook)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.payments"
    label = "payments"
    verbose_name = "Payments"

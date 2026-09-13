"""Django admin for payments."""

from django.contrib import admin

from apps.payments.models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    """Browse payment attempts by order and provider id."""

    list_display = (
        "id",
        "order",
        "provider_payment_id",
        "status",
        "amount",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = ("id", "provider_payment_id", "order__id")
    readonly_fields = (
        "id",
        "provider_payment_id",
        "amount",
        "confirmation_url",
        "raw_payload",
        "created_at",
        "updated_at",
    )

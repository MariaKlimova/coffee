"""Payment API serializers."""

from rest_framework import serializers

from apps.catalog.serializers import MoneyField
from apps.payments.models import Payment


class PaymentCreateSerializer(serializers.Serializer):
    """Request body for POST /api/payments/create/."""

    order_id = serializers.UUIDField()


class PaymentSessionSerializer(serializers.ModelSerializer):
    """Payment session returned after create (OpenAPI PaymentSession)."""

    amount = MoneyField(read_only=True)
    payment_url = serializers.URLField(source="confirmation_url", read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "order_id",
            "status",
            "amount",
            "payment_url",
            "created_at",
        )
        read_only_fields = fields

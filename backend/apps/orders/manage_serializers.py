"""Explicit, read-only staff projections; provider payloads never cross this API."""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.catalog.serializers import MoneyField
from apps.orders.models import Order
from apps.orders.serializers import OrderItemSerializer, OrderListSerializer
from apps.payments.models import Payment


class ManageOrderListSerializer(OrderListSerializer):
    """Only the contact details needed to identify a customer's order."""

    customer_email = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    latest_payment_status = serializers.ChoiceField(
        choices=Payment.Status.choices,
        allow_null=True,
        read_only=True,
        help_text=(
            "Stored local status of the latest attempt by created_at then UUID "
            "descending; null if none. Not an aggregate financial outcome."
        ),
    )

    @extend_schema_field(serializers.EmailField(allow_null=True))
    def get_customer_email(self, order: Order) -> str | None:
        return order.guest_email or (order.user.email if order.user else None)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_customer_phone(self, order: Order) -> str | None:
        account_phone = order.user.phone if order.user else None
        return order.guest_phone or account_phone or None

    class Meta(OrderListSerializer.Meta):
        fields = (
            *OrderListSerializer.Meta.fields,
            "customer_email",
            "customer_phone",
            "latest_payment_status",
        )
        read_only_fields = fields


class ManagePaymentSerializer(serializers.ModelSerializer):
    """Attempt status and amount, without redirect links or provider internals."""

    amount = MoneyField(read_only=True)

    class Meta:
        model = Payment
        fields = ("id", "status", "amount", "created_at", "updated_at")
        read_only_fields = fields


class ManageOrderSerializer(ManageOrderListSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payments = ManagePaymentSerializer(many=True, read_only=True)

    class Meta(ManageOrderListSerializer.Meta):
        fields = (
            *ManageOrderListSerializer.Meta.fields,
            "delivery_address",
            "items",
            "payments",
            "updated_at",
        )
        read_only_fields = fields

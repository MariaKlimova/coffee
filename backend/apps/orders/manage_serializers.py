"""Explicit, read-only staff projections; provider payloads never cross this API."""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.catalog.serializers import MoneyField
from apps.orders.models import Order, OrderStatusTransition
from apps.orders.serializers import OrderItemSerializer, OrderListSerializer
from apps.orders.workflow import allowed_order_transitions
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


class AllowedOrderTransitionSerializer(serializers.Serializer):
    to_status = serializers.ChoiceField(choices=Order.Status.choices)
    inventory_effect = serializers.ChoiceField(
        choices=["release_reservation", "restore_stock", "none"]
    )
    inventory_reason = serializers.ChoiceField(
        choices=["legacy_uncounted"], allow_null=True
    )


class TransitionActorSerializer(serializers.Serializer):
    id = serializers.UUIDField(allow_null=True)
    label = serializers.CharField()


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    @extend_schema_field(TransitionActorSerializer(allow_null=True))
    def get_actor(self, event):
        if not event.actor_label:
            return None
        return {
            "id": str(event.actor_id) if event.actor_id else None,
            "label": event.actor_label,
        }

    class Meta:
        model = OrderStatusTransition
        fields = (
            "id",
            "from_status",
            "to_status",
            "created_at",
            "source",
            "actor",
            "comment",
        )
        read_only_fields = fields


class ManageOrderSerializer(ManageOrderListSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payments = ManagePaymentSerializer(many=True, read_only=True)
    allowed_transitions = serializers.SerializerMethodField()
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)

    @extend_schema_field(AllowedOrderTransitionSerializer(many=True))
    def get_allowed_transitions(self, order):
        return allowed_order_transitions(order)

    class Meta(ManageOrderListSerializer.Meta):
        fields = (
            *ManageOrderListSerializer.Meta.fields,
            "delivery_address",
            "items",
            "payments",
            "updated_at",
            "allowed_transitions",
            "status_history",
        )
        read_only_fields = fields


class OrderTransitionRequestSerializer(serializers.Serializer):
    expected_status = serializers.ChoiceField(choices=Order.Status.choices)
    to_status = serializers.ChoiceField(choices=Order.Status.choices)
    request_id = serializers.UUIDField()
    comment = serializers.CharField(max_length=500, allow_blank=True, default="")

    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - self.fields.keys()
            if unknown:
                raise serializers.ValidationError(
                    {name: ["Unknown field."] for name in sorted(unknown)}
                )
        return super().to_internal_value(data)


class OrderTransitionResponseSerializer(serializers.Serializer):
    order = ManageOrderSerializer(read_only=True)
    replayed = serializers.BooleanField(read_only=True)


class OrderTransitionErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()
    code = serializers.CharField()
    errors = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()), required=False
    )

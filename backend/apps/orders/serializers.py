"""Order API serializers."""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.catalog.serializers import MoneyField
from apps.orders.models import Order, OrderItem


class OrderCreateSerializer(serializers.Serializer):
    """Request body for POST /api/orders/."""

    checkout_request_id = serializers.UUIDField(required=False)
    delivery_address = serializers.CharField(max_length=2000)
    guest_email = serializers.EmailField(required=False, allow_blank=False)
    guest_phone = serializers.CharField(
        required=False,
        allow_blank=False,
        max_length=32,
    )

    def validate(self, attrs: dict) -> dict:
        request = self.context.get("request")
        is_authenticated = (
            request is not None
            and getattr(request, "user", None) is not None
            and request.user.is_authenticated
        )
        if is_authenticated:
            if "checkout_request_id" in attrs:
                raise serializers.ValidationError(
                    {"checkout_request_id": ["Guest checkout only."]}
                )
            return attrs

        missing: dict[str, list[str]] = {}
        if not attrs.get("guest_email"):
            missing["guest_email"] = ["This field is required for guest checkout."]
        if not attrs.get("guest_phone"):
            missing["guest_phone"] = ["This field is required for guest checkout."]
        if missing:
            raise serializers.ValidationError(missing)
        return attrs


class OrderItemSerializer(serializers.ModelSerializer):
    """Frozen line item on an order."""

    product_price = MoneyField(read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product_id",
            "product_name",
            "product_price",
            "quantity",
        )
        read_only_fields = fields


class OrderListSerializer(serializers.ModelSerializer):
    """Order row for paginated list responses."""

    total = MoneyField(source="total_amount", read_only=True)
    items_count = serializers.SerializerMethodField(
        help_text="Number of frozen order positions, not the sum of quantities."
    )

    @extend_schema_field(serializers.IntegerField(min_value=0, read_only=True))
    def get_items_count(self, order: Order) -> int:
        count = getattr(order, "_items_count", None)
        return count if count is not None else order.items.count()

    class Meta:
        model = Order
        fields = (
            "id",
            "status",
            "total",
            "items_count",
            "created_at",
            "reservation_state",
            "reservation_expires_at",
            "stock_review_reason",
        )
        read_only_fields = fields


class OrderSerializer(OrderListSerializer):
    """Full order payload including line snapshots."""

    items = OrderItemSerializer(many=True, read_only=True)
    guest_email = serializers.EmailField(read_only=True, allow_null=True)
    guest_phone = serializers.CharField(read_only=True, allow_null=True)

    class Meta(OrderListSerializer.Meta):
        fields = (
            "id",
            "status",
            "total",
            "items_count",
            "delivery_address",
            "guest_email",
            "guest_phone",
            "items",
            "created_at",
            "updated_at",
            "reservation_state",
            "reservation_expires_at",
            "stock_review_reason",
        )
        read_only_fields = fields

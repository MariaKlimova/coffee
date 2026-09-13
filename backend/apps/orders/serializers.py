"""Order API serializers."""

from rest_framework import serializers

from apps.catalog.serializers import MoneyField
from apps.orders.models import Order, OrderItem


class OrderCreateSerializer(serializers.Serializer):
    """Request body for POST /api/orders/."""

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

    class Meta:
        model = Order
        fields = ("id", "status", "total", "created_at")
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    """Full order payload including line snapshots."""

    total = MoneyField(source="total_amount", read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    guest_email = serializers.EmailField(read_only=True, allow_null=True)
    guest_phone = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "status",
            "total",
            "delivery_address",
            "guest_email",
            "guest_phone",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

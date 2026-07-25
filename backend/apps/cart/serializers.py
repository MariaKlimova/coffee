"""Cart API serializers."""

from decimal import Decimal

from rest_framework import serializers

from apps.cart.models import Cart, CartItem
from apps.cart.services import cart_total, line_total
from apps.catalog.serializers import MoneyField, ProductListSerializer


class CartItemCreateSerializer(serializers.Serializer):
    """Request body for POST /api/cart/items/."""

    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)


class CartItemUpdateSerializer(serializers.Serializer):
    """Request body for PATCH /api/cart/items/{id}/."""

    quantity = serializers.IntegerField(min_value=1)


class CartMergeSerializer(serializers.Serializer):
    """Request body for POST /api/cart/merge/."""

    cart_token = serializers.UUIDField()


class CartItemSerializer(serializers.ModelSerializer):
    """Single cart line with embedded product and line total."""

    product = ProductListSerializer(read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = ("id", "product", "quantity", "line_total")
        read_only_fields = fields

    def get_line_total(self, obj: CartItem) -> str:
        return MoneyField().to_representation(line_total(obj))


class CartSerializer(serializers.ModelSerializer):
    """Full cart payload for GET /api/cart/ and merge response."""

    items = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()
    cart_token = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = Cart
        fields = (
            "id",
            "items",
            "total",
            "items_count",
            "cart_token",
            "updated_at",
        )
        read_only_fields = fields

    def _items(self, obj: Cart):
        cached = self.context.get("cart_items")
        if cached is not None:
            return cached
        return list(obj.items.select_related("product").all())

    def get_items(self, obj: Cart) -> list:
        items = self._items(obj)
        return CartItemSerializer(
            items,
            many=True,
            context=self.context,
        ).data

    def get_total(self, obj: Cart) -> str:
        total: Decimal = cart_total(self._items(obj))
        return MoneyField().to_representation(total)

    def get_items_count(self, obj: Cart) -> int:
        return len(self._items(obj))

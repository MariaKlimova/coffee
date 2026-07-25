"""Django admin for carts (ops visibility)."""

from django.contrib import admin

from apps.cart.models import Cart, CartItem


class CartItemInline(admin.TabularInline):
    """Inline lines on the cart change page."""

    model = CartItem
    extra = 0
    readonly_fields = ("added_at",)


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    """Browse carts by user or guest token."""

    list_display = ("id", "user", "cart_token", "updated_at", "created_at")
    list_filter = ("updated_at",)
    search_fields = ("user__email", "cart_token", "id")
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [CartItemInline]


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    """Browse individual cart lines."""

    list_display = ("id", "cart", "product", "quantity", "added_at")
    list_filter = ("added_at",)
    search_fields = ("product__name", "product__slug", "cart__id")
    readonly_fields = ("id", "added_at")

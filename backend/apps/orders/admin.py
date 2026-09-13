"""Django admin for orders."""

from django.contrib import admin

from apps.orders.models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    """Inline line snapshots on the order change page."""

    model = OrderItem
    extra = 0
    readonly_fields = (
        "id",
        "product",
        "product_name",
        "product_price",
        "quantity",
    )


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    """Browse orders by user, guest contact, or status."""

    list_display = (
        "id",
        "user",
        "guest_email",
        "status",
        "total_amount",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "id",
        "user__email",
        "guest_email",
        "guest_phone",
        "delivery_address",
    )
    readonly_fields = ("id", "created_at", "updated_at", "total_amount")
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    """Browse individual order lines."""

    list_display = (
        "id",
        "order",
        "product_name",
        "product_price",
        "quantity",
        "product",
    )
    search_fields = ("product_name", "order__id")
    readonly_fields = ("id",)

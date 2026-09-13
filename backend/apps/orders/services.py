"""Create order from cart and related helpers."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.base_user import AbstractBaseUser
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.cart.models import Cart, CartItem
from apps.orders.models import Order, OrderItem


def create_order_from_cart(
    *,
    cart: Cart,
    delivery_address: str,
    user: AbstractBaseUser | None,
    guest_email: str | None = None,
    guest_phone: str | None = None,
) -> Order:
    """
    Snapshot cart lines into a new ``pending`` order and clear the cart.

    Raises ValidationError if the cart is empty or any line's product is
    out of stock (``in_stock=False``). No order is created on failure.
    """
    with transaction.atomic():
        items = list(
            CartItem.objects.select_related("product")
            .select_for_update()
            .filter(cart=cart)
            .order_by("added_at"),
        )

        if not items:
            raise ValidationError(
                {"non_field_errors": ["Cart is empty."]},
                code="empty_cart",
            )

        unavailable: list[str] = []
        for item in items:
            product = item.product
            if product is None or not product.in_stock:
                name = product.name if product is not None else str(item.product_id)
                unavailable.append(name)

        if unavailable:
            names = ", ".join(unavailable)
            raise ValidationError(
                {
                    "non_field_errors": [
                        f"Some items are unavailable: {names}.",
                    ],
                    "unavailable_products": unavailable,
                },
                code="unavailable_products",
            )

        total = Decimal("0.00")
        for item in items:
            total += item.product.price * item.quantity

        order_user = user if user is not None and user.is_authenticated else None
        order = Order.objects.create(
            user=order_user,
            guest_email=guest_email if order_user is None else None,
            guest_phone=guest_phone if order_user is None else None,
            delivery_address=delivery_address,
            status=Order.Status.PENDING,
            total_amount=total,
        )

        OrderItem.objects.bulk_create(
            [
                OrderItem(
                    order=order,
                    product=item.product,
                    product_name=item.product.name,
                    product_price=item.product.price,
                    quantity=item.quantity,
                )
                for item in items
            ],
        )

        CartItem.objects.filter(cart=cart).delete()

        return order

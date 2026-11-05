"""Atomic cart snapshots, inventory reservations and cancellation/expiry."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.cart.models import Cart, CartItem
from apps.catalog.models import Product
from apps.catalog.services import lock_products, validate_available
from apps.orders.history import record_status_transition
from apps.orders.models import (
    Order,
    OrderItem,
    OrderStatusTransition,
    StockReservationLine,
)


@transaction.atomic
def create_order_from_cart(
    *, cart, delivery_address, user, guest_email=None, guest_phone=None
):
    # Cart lock serializes add/PATCH/merge/delete/checkout, even for an empty cart.
    Cart.objects.select_for_update().get(pk=cart.pk)
    items = list(CartItem.objects.filter(cart=cart).order_by("product_id"))
    if not items:
        raise ValidationError(
            {"non_field_errors": ["Cart is empty."]}, code="empty_cart"
        )
    products = lock_products([item.product_id for item in items])
    for item in items:
        validate_available(products[item.product_id], item.quantity)
    total = sum(
        (products[item.product_id].price * item.quantity for item in items),
        Decimal("0.00"),
    )
    order_user = user if user is not None and user.is_authenticated else None
    order = Order.objects.create(
        user=order_user,
        guest_email=guest_email if order_user is None else None,
        guest_phone=guest_phone if order_user is None else None,
        delivery_address=delivery_address,
        total_amount=total,
        reservation_state=Order.ReservationState.ACTIVE,
        reservation_expires_at=timezone.now()
        + timedelta(seconds=settings.STOCK_RESERVATION_TTL_SECONDS),
    )
    OrderItem.objects.bulk_create(
        [
            OrderItem(
                order=order,
                product=products[item.product_id],
                product_name=products[item.product_id].name,
                product_price=products[item.product_id].price,
                quantity=item.quantity,
            )
            for item in items
        ]
    )
    StockReservationLine.objects.bulk_create(
        [
            StockReservationLine(
                order=order, product_id=item.product_id, quantity=item.quantity
            )
            for item in items
        ]
    )
    for item in items:
        product = products[item.product_id]
        Product.objects.filter(pk=product.pk).update(
            reserved_quantity=product.reserved_quantity + item.quantity
        )
    CartItem.objects.filter(cart=cart).delete()
    return order


def _release_locked(order, products=None):
    """Caller holds the order lock. Counters and state commit together."""
    if order.reservation_state != Order.ReservationState.ACTIVE:
        return False
    lines = list(order.stock_lines.order_by("product_id"))
    if products is None:
        products = lock_products([line.product_id for line in lines])
    for line in lines:
        product = products[line.product_id]
        product.reserved_quantity -= line.quantity
        Product.objects.filter(pk=product.pk).update(
            reserved_quantity=product.reserved_quantity
        )
    order.reservation_state = Order.ReservationState.RELEASED
    return True


@transaction.atomic
def cancel_unpaid_order(*, order_id):
    """Internal transition for COFFEE-61; its API must authorize the caller first.

    Never cancels/refunds a paid order. A late confirmed payment is separately
    retained as payment_review. No provider cancellation/refund is performed.
    """
    order = Order.objects.select_for_update().get(pk=order_id)
    if order.status == Order.Status.CANCELLED:
        return order
    if (
        order.status != Order.Status.PENDING
        or order.payments.filter(status="succeeded").exists()
    ):
        raise ValidationError(
            {"status": ["Only an unpaid pending order can be cancelled."]}
        )
    _release_locked(order)
    order.status = Order.Status.CANCELLED
    order.save(update_fields=["status", "reservation_state", "updated_at"])
    return order


def consume_paid_reservation(order):
    """Caller holds order lock. Confirmed money never disappears after expiry."""
    # Legacy paid cancellations keep NONE, since no counted stock existed.
    # Their actual staff audit distinguishes them from an unpaid cancellation,
    # whose first late payment must still become visible as payment_review.
    cancelled_after_payment = (
        order.status == Order.Status.CANCELLED
        and order.status_history.filter(
            source=OrderStatusTransition.Source.STAFF,
            from_status__in=[Order.Status.PAID, Order.Status.PROCESSING],
            to_status=Order.Status.CANCELLED,
        ).exists()
    )
    if (
        order.reservation_state
        in (
            Order.ReservationState.CONSUMED,
            Order.ReservationState.RESTORED,
        )
        or cancelled_after_payment
        or order.status
        in (
            Order.Status.PROCESSING,
            Order.Status.SHIPPED,
            Order.Status.DELIVERED,
        )
    ):
        return
    previous_status = order.status
    if (
        order.reservation_state == Order.ReservationState.ACTIVE
        and order.reservation_expires_at > timezone.now()
    ):
        lines = list(order.stock_lines.order_by("product_id"))
        products = lock_products([line.product_id for line in lines])
        for line in lines:
            product = products[line.product_id]
            Product.objects.filter(pk=product.pk).update(
                stock_quantity=product.stock_quantity - line.quantity,
                reserved_quantity=product.reserved_quantity - line.quantity,
            )
        order.reservation_state = Order.ReservationState.CONSUMED
        order.status = Order.Status.PAID
    else:
        _release_locked(order)
        order.status = Order.Status.PAYMENT_REVIEW
        order.stock_review_reason = (
            "payment_after_reservation_release"
            if order.reservation_state == Order.ReservationState.RELEASED
            else "legacy_order_without_counted_stock"
        )
    order.save(
        update_fields=[
            "status",
            "reservation_state",
            "stock_review_reason",
            "updated_at",
        ]
    )
    record_status_transition(
        order, previous_status, source=OrderStatusTransition.Source.PAYMENT
    )


def restore_paid_stock(order):
    """Caller holds Order lock; restore only the immutable counted allocation."""
    if order.reservation_state != Order.ReservationState.CONSUMED:
        return False
    lines = list(order.stock_lines.order_by("product_id"))
    products = lock_products([line.product_id for line in lines])
    for line in lines:
        product = products[line.product_id]
        quantity = product.stock_quantity + line.quantity
        if quantity > 2147483647:
            raise ValidationError(
                {"stock": ["Returned stock exceeds the storage limit."]}
            )
        Product.objects.filter(pk=product.pk).update(stock_quantity=quantity)
    order.reservation_state = Order.ReservationState.RESTORED
    return True


def expire_stock_reservations(*, now=None, batch_size=100):
    """Bounded, competing-worker-safe cleanup; no provider I/O or refunds."""
    now = now or timezone.now()
    candidates = Order.objects.filter(
        reservation_state=Order.ReservationState.ACTIVE,
        reservation_expires_at__lte=now,
        status=Order.Status.PENDING,
    )
    # Idle traffic does one indexed read without opening a write transaction.
    if not candidates.exists():
        return 0
    with transaction.atomic():
        orders = list(
            candidates.select_for_update(skip_locked=True).order_by(
                "reservation_expires_at", "pk"
            )[:batch_size]
        )
        # Lock the union once: different batches must not lock shared products
        # in opposite order across different orders.
        products = lock_products(
            StockReservationLine.objects.filter(order__in=orders).values_list(
                "product_id", flat=True
            )
        )
        for order in orders:
            previous_status = order.status
            _release_locked(order, products)
            order.status = Order.Status.CANCELLED
            order.save(update_fields=["status", "reservation_state", "updated_at"])
            record_status_transition(
                order,
                previous_status,
                source=OrderStatusTransition.Source.RESERVATION_EXPIRY,
            )
        return len(orders)

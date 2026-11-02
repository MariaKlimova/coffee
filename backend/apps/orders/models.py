"""Order and OrderItem models — cart snapshot at checkout."""

import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Order(models.Model):
    """
    Placed order with a frozen total and line snapshots.

    Authenticated users are linked via ``user``. Guests leave ``user`` null and
    provide ``guest_email`` / ``guest_phone`` (validated at serializer level).
    """

    class Status(models.TextChoices):
        """Lifecycle of an order from creation through delivery or cancel."""

        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        PROCESSING = "processing", "Processing"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"
        PAYMENT_REVIEW = "payment_review", "Paid; manual stock review required"

    class ReservationState(models.TextChoices):
        NONE = "none", "Legacy: no counted reservation"
        ACTIVE = "active", "Active"
        CONSUMED = "consumed", "Consumed"
        RELEASED = "released", "Released"

    reservation_state = models.CharField(
        max_length=12,
        choices=ReservationState.choices,
        default=ReservationState.NONE,
        editable=False,
    )
    reservation_expires_at = models.DateTimeField(null=True, blank=True, editable=False)
    stock_review_reason = models.CharField(
        max_length=100, blank=True, default="", editable=False
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="orders",
        null=True,
        blank=True,
    )
    guest_email = models.EmailField(null=True, blank=True)
    guest_phone = models.CharField(max_length=32, null=True, blank=True)
    delivery_address = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "order"
        verbose_name_plural = "orders"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["reservation_state", "reservation_expires_at"])]

    def __str__(self) -> str:
        return f"Order({self.id}, {self.status})"


class OrderItem(models.Model):
    """
    One line in an order with name/price snapshotted at checkout.

    ``product`` may become null if the catalog product is later deleted;
    ``product_name`` / ``product_price`` remain the source of truth for history.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.SET_NULL,
        related_name="order_items",
        null=True,
        blank=True,
    )
    product_name = models.CharField(max_length=255)
    product_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
    )

    class Meta:
        verbose_name = "order item"
        verbose_name_plural = "order items"
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.product_name} × {self.quantity}"


class StockReservationLine(models.Model):
    """Immutable counted allocation; protects inventory products from deletion."""

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="stock_lines"
    )
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["order", "product"], name="orders_one_stock_line_per_product"
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1), name="orders_stock_line_positive"
            ),
        ]

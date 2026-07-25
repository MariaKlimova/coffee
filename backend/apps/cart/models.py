"""Cart and CartItem models for guest and authenticated users."""

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models


class Cart(models.Model):
    """
    Shopping cart owned by either a user or a guest cart_token.

    Exactly one of ``user`` / ``cart_token`` must be set (enforced in clean()
    and via a DB CheckConstraint).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="carts",
        null=True,
        blank=True,
    )
    cart_token = models.UUIDField(
        null=True,
        blank=True,
        unique=True,
        help_text="Guest cart identifier; null for authenticated carts.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "cart"
        verbose_name_plural = "carts"
        ordering = ["-updated_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(user__isnull=False, cart_token__isnull=True)
                    | models.Q(user__isnull=True, cart_token__isnull=False)
                ),
                name="cart_cart_user_xor_token",
            ),
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(user__isnull=False),
                name="cart_cart_user_uniq",
            ),
        ]

    def clean(self) -> None:
        has_user = self.user_id is not None
        has_token = self.cart_token is not None
        if has_user == has_token:
            raise ValidationError(
                "Cart must have either user or cart_token, but not both.",
            )

    def __str__(self) -> str:
        if self.user_id:
            return f"Cart(user={self.user_id})"
        return f"Cart(token={self.cart_token})"


class CartItem(models.Model):
    """
    One product line in a cart.

    Uniqueness of (cart, product) is enforced at the DB level; adding the
    same product again increases ``quantity`` instead of creating a new row.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.CASCADE,
        related_name="cart_items",
    )
    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "cart item"
        verbose_name_plural = "cart items"
        ordering = ["added_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "product"],
                name="cart_cartitem_cart_product_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.cart_id} → {self.product_id} × {self.quantity}"

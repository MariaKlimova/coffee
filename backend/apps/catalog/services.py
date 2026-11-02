"""Inventory locks and the single audited staff stock adjustment entry point."""

from collections.abc import Iterable
from uuid import UUID

from django.contrib.auth import get_user_model
from django.contrib.auth.base_user import AbstractBaseUser
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from apps.catalog.models import Product, StockAdjustment
from apps.catalog.visibility import is_visible


class InsufficientStock(APIException):
    status_code = 400
    default_code = "insufficient_stock"
    default_detail = "The requested quantity is unavailable."

    def __init__(self, product: Product, quantity: int):
        self.product_id = str(product.pk)
        self.available_quantity = (
            product.available_quantity if is_visible(product) else 0
        )
        self.requested_quantity = quantity
        super().__init__(
            f"{product.name}: requested {quantity}, "
            f"available {self.available_quantity}.",
            code=self.default_code,
        )


def validate_available(product: Product, quantity: int) -> None:
    if quantity < 1:
        raise ValidationError({"quantity": ["Quantity must be at least 1."]})
    if not is_visible(product) or quantity > product.available_quantity:
        raise InsufficientStock(product, quantity)


def lock_products(product_ids: Iterable[UUID | str]) -> dict[UUID, Product]:
    # Every multi-product operation uses the same order to prevent deadlocks.
    return {
        product.pk: product
        for product in Product.objects.select_for_update()
        .filter(pk__in=product_ids)
        .order_by("pk")
    }


@transaction.atomic
def adjust_stock(
    *, product_id: UUID, quantity: int, actor: AbstractBaseUser | None, reason: str
) -> Product:
    """Set physical stock without consuming reservations; COFFEE-42 calls this."""
    # Re-check persisted privileges, not a caller-supplied/stale is_staff flag.
    if (
        not getattr(actor, "is_authenticated", False)
        or not get_user_model()
        .objects.filter(pk=actor.pk, is_active=True, is_staff=True)
        .exists()
    ):
        raise PermissionDenied("Only active staff can adjust stock.")
    if (
        isinstance(quantity, bool)
        or not isinstance(quantity, int)
        or not 0 <= quantity <= 2147483647
    ):
        raise ValidationError(
            {"quantity": ["Must be an integer between 0 and 2147483647."]}
        )
    if not isinstance(reason, str) or not reason.strip() or len(reason) > 500:
        raise ValidationError({"reason": ["A reason of 1–500 characters is required."]})
    product = Product.objects.select_for_update().get(pk=product_id)
    if quantity < product.reserved_quantity:
        raise ValidationError(
            {
                "quantity": [
                    f"Cannot be below reserved quantity {product.reserved_quantity}."
                ]
            }
        )
    before = product.stock_quantity
    Product.objects.filter(pk=product.pk).update(
        stock_quantity=quantity, updated_at=timezone.now()
    )
    StockAdjustment.objects.create(
        product=product,
        actor=actor,
        before_quantity=before,
        after_quantity=quantity,
        reason=reason.strip(),
    )
    product.stock_quantity = quantity
    return product

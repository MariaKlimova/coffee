"""Atomic staff catalog changes and the one-way, idempotent demo cutover."""

from uuid import uuid4

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from apps.catalog.models import CatalogState, Product
from apps.catalog.services import adjust_stock


def write_product(*, data, actor, product=None):
    """Caller owns the transaction and the existing product row lock."""
    values = dict(data)
    quantity = values.pop("stock_quantity", None)
    reason = values.pop("stock_change_reason", "Catalog stock adjustment")
    save_as_owner = values.pop("save_as_owner", False)
    if product is None:
        base = slugify(values["name"])[:220] or "product"
        for _attempt in range(3):
            try:
                with transaction.atomic():
                    product = Product.objects.create(
                        **values, slug=f"{base}-{uuid4().hex[:16]}"
                    )
                break
            except IntegrityError:
                if _attempt == 2:
                    raise
    else:
        for name, value in values.items():
            setattr(product, name, value)
        if save_as_owner:
            product.origin = Product.Origin.OWNER
        product.save()
    if quantity is not None:
        try:
            adjust_stock(
                product_id=product.pk, quantity=quantity, actor=actor, reason=reason
            )
        except ValidationError as exc:
            detail = dict(exc.detail)
            if "quantity" in detail:
                detail["stock_quantity"] = detail.pop("quantity")
            raise ValidationError(detail) from exc
    product.refresh_from_db()
    return product


def catalog_state():
    state, _ = CatalogState.objects.get_or_create(pk=1)
    state.demo_product_count = Product.objects.filter(
        origin=Product.Origin.DEMO
    ).count()
    owners = Product.objects.filter(origin=Product.Origin.OWNER)
    state.owner_product_count = owners.count()
    state.published_owner_product_count = owners.filter(is_published=True).count()
    return state


@transaction.atomic
def disable_demo(*, actor):
    # Match checkout's deterministic product lock order. A checkout that already
    # owns a row can finish its reservation before cutover; one waiting behind
    # cutover sees demo_enabled=False and cannot reserve hidden demo stock.
    list(
        Product.objects.select_for_update()
        .filter(origin=Product.Origin.DEMO)
        .order_by("pk")
        .values_list("pk", flat=True)
    )
    CatalogState.objects.get_or_create(pk=1)
    state = CatalogState.objects.select_for_update().get(pk=1)
    if state.demo_enabled:
        state.demo_enabled = False
        state.switched_at = timezone.now()
        state.switched_by = actor
        state.save(update_fields=["demo_enabled", "switched_at", "switched_by"])
    return catalog_state()

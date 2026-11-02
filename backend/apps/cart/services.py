"""Cart resolve, add-item, and merge helpers."""

from __future__ import annotations

import uuid
from decimal import Decimal

from django.contrib.auth.base_user import AbstractBaseUser
from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from rest_framework.exceptions import NotFound
from rest_framework.request import Request

from apps.cart.models import Cart, CartItem
from apps.catalog.models import Product, ProductImage
from apps.catalog.services import lock_products, validate_available
from apps.favorites.query import annotate_is_favorite

CART_TOKEN_HEADER = "X-Cart-Token"


def cart_token_from_request(request: Request) -> uuid.UUID | None:
    """Parse ``X-Cart-Token`` header; invalid values are treated as missing."""
    raw = request.headers.get(CART_TOKEN_HEADER)
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except (ValueError, TypeError, AttributeError):
        return None


def get_or_create_user_cart(user: AbstractBaseUser) -> Cart:
    """Get or create the authenticated user's cart (IntegrityError-safe)."""
    try:
        cart, _created = Cart.objects.get_or_create(
            user=user,
            defaults={"cart_token": None},
        )
    except IntegrityError:
        cart = Cart.objects.get(user=user)
    return cart


def get_or_create_cart(request: Request) -> Cart:
    """
    Resolve the current cart for the request.

    Authenticated users get (or create) a cart by ``user``.
    Guests use ``X-Cart-Token``. Missing header or unknown/stale token creates
    a new guest cart (and returns a fresh token in the response header).
    """
    user = request.user
    if user is not None and user.is_authenticated:
        return get_or_create_user_cart(user)

    token = cart_token_from_request(request)
    if token is not None:
        guest = Cart.objects.filter(cart_token=token, user__isnull=True).first()
        if guest is not None:
            return guest

    return Cart.objects.create(user=None, cart_token=uuid.uuid4())


def touch_cart(cart: Cart) -> None:
    """Bump ``updated_at`` after item mutations."""
    cart.save(update_fields=["updated_at"])


def _product_images_prefetch() -> Prefetch:
    return Prefetch(
        "images",
        queryset=ProductImage.objects.order_by("order", "id"),
    )


def prepare_cart_item(item: CartItem, *, user: AbstractBaseUser | None) -> CartItem:
    """Attach gallery prefetch and ``is_favorite`` on the item's product."""
    annotated = annotate_is_favorite(
        Product.objects.filter(pk=item.product_id)
        .select_related("category")
        .prefetch_related(_product_images_prefetch()),
        user,
    ).first()
    if annotated is not None:
        item.product = annotated
    return item


def cart_items_queryset(cart: Cart, *, user: AbstractBaseUser | None):
    """
    Cart items with product gallery prefetch and ``is_favorite`` on products.

    Returns a list (not a lazy queryset) so annotated products are attached.
    """
    images_qs = ProductImage.objects.order_by("order", "id")
    items = list(
        CartItem.objects.filter(cart=cart)
        .select_related("product", "product__category")
        .prefetch_related(Prefetch("product__images", queryset=images_qs))
        .order_by("added_at"),
    )
    product_ids = [item.product_id for item in items]
    if not product_ids:
        return items

    annotated = {
        product.id: product
        for product in annotate_is_favorite(
            Product.objects.filter(pk__in=product_ids)
            .select_related("category")
            .prefetch_related(Prefetch("images", queryset=images_qs)),
            user,
        )
    }
    for item in items:
        annotated_product = annotated.get(item.product_id)
        if annotated_product is not None:
            item.product = annotated_product
    return items


def line_total(item: CartItem) -> Decimal:
    """Price × quantity for a cart line."""
    return item.product.price * item.quantity


def cart_total(items) -> Decimal:
    """Sum of line totals."""
    total = Decimal("0.00")
    for item in items:
        total += line_total(item)
    return total


@transaction.atomic
def add_item(*, cart: Cart, product_id, quantity: int) -> CartItem:
    """Check final quantity under cart/product locks; carts never reserve."""
    Cart.objects.select_for_update().get(pk=cart.pk)
    product = next(iter(lock_products([product_id]).values()), None)
    if product is None:
        raise NotFound(detail="Product not found.", code="not_found")
    item = CartItem.objects.filter(cart=cart, product=product).first()
    final_quantity = quantity + (item.quantity if item else 0)
    validate_available(product, final_quantity)
    if item is None:
        item = CartItem.objects.create(cart=cart, product=product, quantity=quantity)
    else:
        item.quantity = final_quantity
        item.save(update_fields=["quantity"])
    touch_cart(cart)
    return item


def get_cart_item_for_cart(*, cart: Cart, item_id) -> CartItem:
    """Return a cart item belonging to ``cart`` or raise NotFound."""
    try:
        return CartItem.objects.select_related("product").get(
            pk=item_id,
            cart=cart,
        )
    except CartItem.DoesNotExist as exc:
        raise NotFound(
            detail="Cart item not found.",
            code="not_found",
        ) from exc


@transaction.atomic
def update_item_quantity(*, cart: Cart, item_id, quantity: int) -> CartItem:
    """Set the quantity and reject unavailable counts without truncation."""
    Cart.objects.select_for_update().get(pk=cart.pk)
    item = get_cart_item_for_cart(cart=cart, item_id=item_id)
    product = lock_products([item.product_id])[item.product_id]
    validate_available(product, quantity)
    item.quantity = quantity
    item.save(update_fields=["quantity"])
    touch_cart(cart)
    return item


@transaction.atomic
def delete_item(*, cart: Cart, item_id) -> None:
    """Remove a cart item belonging to ``cart``."""
    Cart.objects.select_for_update().get(pk=cart.pk)
    item = get_cart_item_for_cart(cart=cart, item_id=item_id)
    item.delete()
    touch_cart(cart)


@transaction.atomic
def merge_guest_cart(*, user: AbstractBaseUser, cart_token: uuid.UUID) -> Cart:
    """Validate final counts atomically; failure preserves both carts."""
    user_cart = get_or_create_user_cart(user)
    guest = Cart.objects.filter(cart_token=cart_token, user__isnull=True).first()
    if guest is None:
        return user_cart
    list(
        Cart.objects.select_for_update()
        .filter(pk__in=[user_cart.pk, guest.pk])
        .order_by("pk")
    )
    # The guest may have been merged while waiting for its lock.
    if not Cart.objects.filter(pk=guest.pk).exists():
        return user_cart
    guest_items = list(CartItem.objects.filter(cart=guest))
    user_items = {
        item.product_id: item for item in CartItem.objects.filter(cart=user_cart)
    }
    products = lock_products([item.product_id for item in guest_items])
    for item in guest_items:
        previous = user_items.get(item.product_id)
        validate_available(
            products[item.product_id],
            item.quantity + (previous.quantity if previous else 0),
        )
    for item in guest_items:
        previous = user_items.get(item.product_id)
        if previous:
            previous.quantity += item.quantity
            previous.save(update_fields=["quantity"])
        else:
            CartItem.objects.create(
                cart=user_cart, product_id=item.product_id, quantity=item.quantity
            )
    guest.delete()
    touch_cart(user_cart)
    return user_cart

"""Cart resolve, add-item, and merge helpers."""

from __future__ import annotations

import uuid
from decimal import Decimal

from django.contrib.auth.base_user import AbstractBaseUser
from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.request import Request

from apps.cart.models import Cart, CartItem
from apps.catalog.models import Product, ProductImage
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


def add_item(*, cart: Cart, product_id, quantity: int) -> CartItem:
    """
    Add a product to the cart or increase quantity of an existing line.

    Raises ValidationError if the product is out of stock.
    Raises NotFound if the product does not exist.
    """
    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist as exc:
        raise NotFound(
            detail="Product not found.",
            code="not_found",
        ) from exc

    if not product.in_stock:
        raise ValidationError(
            {
                "product_id": [
                    "This product is currently unavailable.",
                ],
            },
        )

    try:
        item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={"quantity": quantity},
        )
    except IntegrityError:
        item = CartItem.objects.get(cart=cart, product=product)
        created = False

    if not created:
        item.quantity += quantity
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


def update_item_quantity(*, cart: Cart, item_id, quantity: int) -> CartItem:
    """Set quantity for a cart item (must be ≥ 1)."""
    if quantity < 1:
        raise ValidationError(
            {"quantity": ["Quantity must be at least 1."]},
        )
    item = get_cart_item_for_cart(cart=cart, item_id=item_id)
    item.quantity = quantity
    item.save(update_fields=["quantity"])
    touch_cart(cart)
    return item


def delete_item(*, cart: Cart, item_id) -> None:
    """Remove a cart item belonging to ``cart``."""
    item = get_cart_item_for_cart(cart=cart, item_id=item_id)
    item.delete()
    touch_cart(cart)


@transaction.atomic
def merge_guest_cart(*, user: AbstractBaseUser, cart_token: uuid.UUID) -> Cart:
    """
    Move guest cart lines into the user's cart, summing quantities on overlap.

    Out-of-stock guest lines are skipped (not transferred). Guest cart is
    deleted after merge. Missing guest cart is a no-op that still returns the
    user cart.
    """
    user_cart = get_or_create_user_cart(user)
    guest = (
        Cart.objects.select_for_update()
        .filter(cart_token=cart_token, user__isnull=True)
        .first()
    )
    if guest is None:
        return user_cart

    if guest.id == user_cart.id:
        return user_cart

    guest_items = list(
        CartItem.objects.select_for_update()
        .filter(cart=guest)
        .select_related("product"),
    )
    for guest_item in guest_items:
        if not guest_item.product.in_stock:
            continue
        try:
            user_item, created = CartItem.objects.select_for_update().get_or_create(
                cart=user_cart,
                product_id=guest_item.product_id,
                defaults={"quantity": guest_item.quantity},
            )
            if not created:
                user_item.quantity += guest_item.quantity
                user_item.save(update_fields=["quantity"])
        except IntegrityError:
            user_item = CartItem.objects.get(
                cart=user_cart,
                product_id=guest_item.product_id,
            )
            user_item.quantity += guest_item.quantity
            user_item.save(update_fields=["quantity"])

    guest.delete()
    touch_cart(user_cart)
    return user_cart

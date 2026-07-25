"""Query helpers for favorites (shared by favorites API and catalog)."""

from __future__ import annotations

from django.contrib.auth.base_user import AbstractBaseUser
from django.db.models import BooleanField, Exists, OuterRef, Prefetch, QuerySet, Value

from apps.catalog.models import Product, ProductImage
from apps.favorites.models import Favorite


def annotate_is_favorite(
    queryset: QuerySet[Product],
    user: AbstractBaseUser | None,
) -> QuerySet[Product]:
    """
    Annotate each product with ``is_favorite`` for the given user.

    Guests and anonymous users get ``False`` without hitting the favorites table.
    For authenticated users uses an ``Exists`` subquery scoped to each product row
    (no full wishlist dump into Python).
    """
    if user is None or not user.is_authenticated:
        return queryset.annotate(
            is_favorite=Value(False, output_field=BooleanField()),
        )

    favorite_exists = Favorite.objects.filter(
        user_id=user.pk,
        product_id=OuterRef("pk"),
    )
    return queryset.annotate(is_favorite=Exists(favorite_exists))


def favorite_products_queryset(*, user: AbstractBaseUser) -> QuerySet[Product]:
    """Products favorited by user, newest favorite first, with gallery prefetch."""
    images_qs = ProductImage.objects.order_by("order", "id")
    return annotate_is_favorite(
        Product.objects.filter(favorites__user=user)
        .select_related("category")
        .prefetch_related(Prefetch("images", queryset=images_qs))
        .order_by("-favorites__created_at"),
        user,
    )

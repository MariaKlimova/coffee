"""Shared storefront and checkout visibility, independent of publication."""

from django.db.models import Exists, Q

from apps.catalog.models import CatalogState, Product


def visible_products(queryset=None):
    if queryset is None:
        queryset = Product.objects.all()
    return queryset.filter(is_published=True).filter(
        Q(origin=Product.Origin.OWNER)
        | ~Exists(CatalogState.objects.filter(pk=1, demo_enabled=False))
    )


def is_visible(product):
    return product.is_published and (
        product.origin != Product.Origin.DEMO
        or not CatalogState.objects.filter(pk=1, demo_enabled=False).exists()
    )

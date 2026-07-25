"""URL routes for the cart API."""

from django.urls import path

from apps.cart.views import (
    CartDetailView,
    CartItemCreateView,
    CartItemDetailView,
    CartMergeView,
)

urlpatterns = [
    path("cart/", CartDetailView.as_view(), name="cart-detail"),
    path("cart/items/", CartItemCreateView.as_view(), name="cart-item-create"),
    path(
        "cart/items/<uuid:id>/",
        CartItemDetailView.as_view(),
        name="cart-item-detail",
    ),
    path("cart/merge/", CartMergeView.as_view(), name="cart-merge"),
]

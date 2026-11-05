"""URL routes for the orders API."""

from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.orders.buyer_views import (
    BuyerActionsView,
    BuyerCancellationRequestView,
    BuyerCancelView,
    GuestCheckoutRecoveryView,
)
from apps.orders.manage_views import ManageOrderViewSet
from apps.orders.views import OrderDetailView, OrderListCreateView

router = SimpleRouter()
router.register("manage/orders", ManageOrderViewSet, basename="manage-order")

urlpatterns = router.urls + [
    path(
        "orders/checkout-recovery/",
        GuestCheckoutRecoveryView.as_view(),
        name="guest-checkout-recovery",
    ),
    path(
        "orders/<uuid:id>/buyer-actions/",
        BuyerActionsView.as_view(),
        name="buyer-order-actions",
    ),
    path(
        "orders/<uuid:id>/cancel/", BuyerCancelView.as_view(), name="buyer-order-cancel"
    ),
    path(
        "orders/<uuid:id>/cancellation-requests/",
        BuyerCancellationRequestView.as_view(),
        name="buyer-cancellation-request",
    ),
    path("orders/", OrderListCreateView.as_view(), name="order-list-create"),
    path(
        "orders/<uuid:id>/",
        OrderDetailView.as_view(),
        name="order-detail",
    ),
]

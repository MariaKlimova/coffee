"""URL routes for the orders API."""

from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.orders.manage_views import ManageOrderViewSet
from apps.orders.views import OrderDetailView, OrderListCreateView

router = SimpleRouter()
router.register("manage/orders", ManageOrderViewSet, basename="manage-order")

urlpatterns = router.urls + [
    path("orders/", OrderListCreateView.as_view(), name="order-list-create"),
    path(
        "orders/<uuid:id>/",
        OrderDetailView.as_view(),
        name="order-detail",
    ),
]

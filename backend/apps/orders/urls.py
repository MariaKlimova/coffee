"""URL routes for the orders API."""

from django.urls import path

from apps.orders.views import OrderDetailView, OrderListCreateView

urlpatterns = [
    path("orders/", OrderListCreateView.as_view(), name="order-list-create"),
    path(
        "orders/<uuid:id>/",
        OrderDetailView.as_view(),
        name="order-detail",
    ),
]

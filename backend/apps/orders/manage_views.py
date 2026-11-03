"""Staff-only order reads. Buyer endpoints and lifecycle writes remain separate."""

from django.db.models import OuterRef, Prefetch, Subquery
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser

from apps.catalog.pagination import CatalogPagination
from apps.orders.manage_filters import filter_manage_orders
from apps.orders.manage_serializers import (
    ManageOrderListSerializer,
    ManageOrderSerializer,
)
from apps.orders.models import Order
from apps.payments.models import Payment


@extend_schema_view(
    list=extend_schema(
        tags=["Manage orders"],
        parameters=[
            OpenApiParameter(
                "search", str, description="UUID, email or phone substring."
            ),
            OpenApiParameter("status", str, enum=Order.Status.values),
            OpenApiParameter("date_from", {"type": "string", "format": "date"}),
            OpenApiParameter("date_to", {"type": "string", "format": "date"}),
        ],
        description="Staff only. Newest first, UUID descending breaks timestamp ties. "
        "Dates are inclusive UTC calendar dates. Account contacts are current profile "
        "values, not checkout snapshots. latest_payment_status is the stored status "
        "of the latest attempt, not an aggregate financial outcome; null means no "
        "attempt. No provider request is performed.",
    ),
    retrieve=extend_schema(tags=["Manage orders"]),
)
class ManageOrderViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdminUser]
    pagination_class = CatalogPagination
    http_method_names = ["get", "head", "options"]

    def get_serializer_class(self):
        return (
            ManageOrderListSerializer
            if self.action == "list"
            else ManageOrderSerializer
        )

    def get_queryset(self):
        queryset = (
            Order.objects.select_related("user")
            .defer("user__password", "user__last_login")
            .annotate(
                latest_payment_status=Subquery(
                    Payment.objects.filter(order_id=OuterRef("pk"))
                    .order_by("-created_at", "-id")
                    .values("status")[:1]
                )
            )
            .order_by("-created_at", "-id")
        )
        if self.action == "list":
            return filter_manage_orders(queryset, self.request.query_params)
        return queryset.prefetch_related(
            "items",
            Prefetch(
                "payments",
                queryset=Payment.objects.only(
                    "id", "order_id", "status", "amount", "created_at", "updated_at"
                ).order_by("-created_at", "-id"),
            ),
        )

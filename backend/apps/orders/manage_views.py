"""Staff order reads and explicit audited lifecycle actions."""

from django.db.models import OuterRef, Prefetch, Subquery
from django.db.models.functions import JSONObject
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from apps.catalog.pagination import CatalogPagination
from apps.orders.buyer_actions import decide_cancellation
from apps.orders.buyer_serializers import CancellationDecisionSerializer
from apps.orders.manage_filters import filter_manage_orders
from apps.orders.manage_serializers import (
    ManageOrderListSerializer,
    ManageOrderSerializer,
    OrderTransitionErrorSerializer,
    OrderTransitionRequestSerializer,
    OrderTransitionResponseSerializer,
)
from apps.orders.models import CancellationRequest, Order
from apps.orders.workflow import transition_order
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
    http_method_names = ["get", "head", "options", "post"]

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
                _open_cancellation_request=Subquery(
                    CancellationRequest.objects.filter(
                        order_id=OuterRef("pk"), state="open"
                    )
                    .annotate(
                        payload=JSONObject(
                            id="id",
                            reason="reason",
                            state="state",
                            created_at="created_at",
                            decided_at="decided_at",
                            public_response="public_response",
                        )
                    )
                    .values("payload")[:1]
                ),
                latest_payment_status=Subquery(
                    Payment.objects.filter(order_id=OuterRef("pk"))
                    .order_by("-created_at", "-id")
                    .values("status")[:1]
                ),
            )
            .order_by("-created_at", "-id")
        )
        if self.action == "list":
            return filter_manage_orders(queryset, self.request.query_params)
        return queryset.prefetch_related(
            "items",
            "status_history",
            "cancellation_requests",
            Prefetch(
                "payments",
                queryset=Payment.objects.only(
                    "id", "order_id", "status", "amount", "created_at", "updated_at"
                ).order_by("-created_at", "-id"),
            ),
        )

    @extend_schema(
        tags=["Manage orders"],
        request=OrderTransitionRequestSerializer,
        responses={
            200: OrderTransitionResponseSerializer,
            400: OrderTransitionErrorSerializer,
            401: OrderTransitionErrorSerializer,
            403: OrderTransitionErrorSerializer,
            404: OrderTransitionErrorSerializer,
            409: OrderTransitionErrorSerializer,
        },
        description="Staff only. Atomic expected-status transition with per-order "
        "request_id idempotency. The same actor and normalized body replay without "
        "a new event; changed body/actor or stale status returns 409. Cancellation "
        "never refunds money or changes a successful payment.",
    )
    @action(detail=True, methods=["post"], url_path="transitions")
    def transitions(self, request, pk=None):
        order_id = self.get_object().pk
        serializer = OrderTransitionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _order, replayed = transition_order(
            order_id=order_id, actor=request.user, **serializer.validated_data
        )
        current = self.get_queryset().get(pk=order_id)
        return Response(
            {"order": ManageOrderSerializer(current).data, "replayed": replayed}
        )

    @extend_schema(
        tags=["Manage orders"],
        parameters=[
            OpenApiParameter(
                "cancellation_id",
                {"type": "string", "format": "uuid"},
                location=OpenApiParameter.PATH,
            )
        ],
        request=CancellationDecisionSerializer,
        responses={
            200: OrderTransitionResponseSerializer,
            400: OrderTransitionErrorSerializer,
            401: OrderTransitionErrorSerializer,
            403: OrderTransitionErrorSerializer,
            404: OrderTransitionErrorSerializer,
            409: OrderTransitionErrorSerializer,
        },
    )
    @action(
        detail=True,
        methods=["post"],
        url_path=r"cancellation-requests/(?P<cancellation_id>[^/.]+)/decision",
    )
    def cancellation_decision(self, request, pk=None, cancellation_id=None):
        order_id = self.get_object().pk
        serializer = CancellationDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _order, replayed = decide_cancellation(
            order_id=order_id,
            cancellation_id=cancellation_id,
            actor=request.user,
            **serializer.validated_data,
        )
        current = self.get_queryset().get(pk=order_id)
        response = Response(
            {"order": ManageOrderSerializer(current).data, "replayed": replayed}
        )
        response["Cache-Control"] = "no-store"
        return response

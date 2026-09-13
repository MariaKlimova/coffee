"""Orders API: create from cart, list, detail."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cart.services import CART_TOKEN_HEADER, get_or_create_cart
from apps.catalog.pagination import CatalogPagination
from apps.orders.access import can_view_order
from apps.orders.models import Order
from apps.orders.serializers import (
    OrderCreateSerializer,
    OrderListSerializer,
    OrderSerializer,
)
from apps.orders.services import create_order_from_cart

ORDER_CART_TOKEN_PARAM = OpenApiParameter(
    name=CART_TOKEN_HEADER,
    type=str,
    location=OpenApiParameter.HEADER,
    required=False,
    description=(
        "Guest cart token (UUID). Required for guest checkout: must identify "
        "an existing non-empty guest cart. Missing or unknown tokens resolve "
        "to a new empty cart and the create fails with 400. Ignored when the "
        "request is authenticated with JWT. This endpoint does not return "
        "X-Cart-Token in the response."
    ),
)


class OrderListCreateView(APIView):
    """GET /api/orders/ (auth) and POST /api/orders/ (guest or auth)."""

    pagination_class = CatalogPagination

    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Orders"],
        responses={200: OrderListSerializer(many=True)},
    )
    def get(self, request: Request) -> Response:
        qs = Order.objects.filter(user=request.user).order_by("-created_at")
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        serializer = OrderListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=["Orders"],
        parameters=[ORDER_CART_TOKEN_PARAM],
        request=OrderCreateSerializer,
        responses={201: OrderSerializer},
    )
    def post(self, request: Request) -> Response:
        create_serializer = OrderCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        create_serializer.is_valid(raise_exception=True)
        data = create_serializer.validated_data

        cart = get_or_create_cart(request)
        user = request.user if request.user.is_authenticated else None

        order = create_order_from_cart(
            cart=cart,
            delivery_address=data["delivery_address"],
            user=user,
            guest_email=data.get("guest_email"),
            guest_phone=data.get("guest_phone"),
        )
        order = Order.objects.prefetch_related("items").get(pk=order.pk)
        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_201_CREATED,
        )


class OrderDetailView(APIView):
    """GET /api/orders/{id}/ — owner, staff, or guest order by UUID."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Orders"],
        responses={200: OrderSerializer},
    )
    def get(self, request: Request, id) -> Response:
        try:
            order = Order.objects.prefetch_related("items").get(pk=id)
        except Order.DoesNotExist as exc:
            raise NotFound(
                detail="Order not found.",
                code="not_found",
            ) from exc

        if not can_view_order(request, order):
            raise NotFound(
                detail="Order not found.",
                code="not_found",
            )

        return Response(OrderSerializer(order).data)

"""Cart API: get cart, add/update/delete items, merge guest cart."""

from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cart.serializers import (
    CartItemCreateSerializer,
    CartItemSerializer,
    CartItemUpdateSerializer,
    CartMergeSerializer,
    CartSerializer,
)
from apps.cart.services import (
    CART_TOKEN_HEADER,
    add_item,
    cart_items_queryset,
    delete_item,
    get_or_create_cart,
    merge_guest_cart,
    prepare_cart_item,
    update_item_quantity,
)

ErrorSerializer = inline_serializer(
    name="CartError",
    fields={
        "detail": serializers.CharField(),
        "code": serializers.CharField(),
        "errors": serializers.DictField(
            child=serializers.ListField(child=serializers.CharField()),
            required=False,
        ),
    },
)

CART_TOKEN_PARAM = OpenApiParameter(
    name=CART_TOKEN_HEADER,
    type=str,
    location=OpenApiParameter.HEADER,
    required=False,
    description=(
        "Guest cart token (UUID). Omit on the first guest request. "
        "Unknown or stale tokens create a new guest cart. "
        "Ignored when the request is authenticated with JWT. "
        "Successful guest responses also return this header."
    ),
)


def _attach_cart_token(response: Response, cart) -> Response:
    """Expose guest ``cart_token`` so the client can store and resend it."""
    if cart.cart_token is not None:
        response[CART_TOKEN_HEADER] = str(cart.cart_token)
    return response


def _serialize_cart(request: Request, cart) -> dict:
    """Build Cart payload with prefetched/annotated items."""
    user = request.user if request.user.is_authenticated else None
    items = cart_items_queryset(cart, user=user)
    return CartSerializer(
        cart,
        context={"request": request, "cart_items": items},
    ).data


def _serialize_cart_item(request: Request, item) -> dict:
    """Serialize a single cart item with product list fields."""
    user = request.user if request.user.is_authenticated else None
    prepared = prepare_cart_item(item, user=user)
    return CartItemSerializer(
        prepared,
        context={"request": request},
    ).data


class CartDetailView(APIView):
    """GET /api/cart/ — current cart for guest or authenticated user."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Cart"],
        parameters=[CART_TOKEN_PARAM],
        responses={200: CartSerializer},
    )
    def get(self, request: Request) -> Response:
        cart = get_or_create_cart(request)
        response = Response(_serialize_cart(request, cart))
        return _attach_cart_token(response, cart)


class CartItemCreateView(APIView):
    """POST /api/cart/items/ — add product or increase quantity."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Cart"],
        parameters=[CART_TOKEN_PARAM],
        request=CartItemCreateSerializer,
        responses={
            201: CartItemSerializer,
            400: ErrorSerializer,
            404: ErrorSerializer,
        },
    )
    def post(self, request: Request) -> Response:
        serializer = CartItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = get_or_create_cart(request)
        item = add_item(
            cart=cart,
            product_id=serializer.validated_data["product_id"],
            quantity=serializer.validated_data["quantity"],
        )
        response = Response(
            _serialize_cart_item(request, item),
            status=status.HTTP_201_CREATED,
        )
        return _attach_cart_token(response, cart)


class CartItemDetailView(APIView):
    """PATCH/DELETE /api/cart/items/{id}/ — update quantity or remove line."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Cart"],
        parameters=[CART_TOKEN_PARAM],
        request=CartItemUpdateSerializer,
        responses={
            200: CartItemSerializer,
            400: ErrorSerializer,
            404: ErrorSerializer,
        },
    )
    def patch(self, request: Request, id) -> Response:
        serializer = CartItemUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = get_or_create_cart(request)
        item = update_item_quantity(
            cart=cart,
            item_id=id,
            quantity=serializer.validated_data["quantity"],
        )
        response = Response(_serialize_cart_item(request, item))
        return _attach_cart_token(response, cart)

    @extend_schema(
        tags=["Cart"],
        parameters=[CART_TOKEN_PARAM],
        responses={
            204: None,
            404: ErrorSerializer,
        },
    )
    def delete(self, request: Request, id) -> Response:
        cart = get_or_create_cart(request)
        delete_item(cart=cart, item_id=id)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return _attach_cart_token(response, cart)


class CartMergeView(APIView):
    """POST /api/cart/merge/ — fold guest cart into the authenticated user's."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Cart"],
        request=CartMergeSerializer,
        responses={
            200: CartSerializer,
            400: ErrorSerializer,
            401: ErrorSerializer,
        },
    )
    def post(self, request: Request) -> Response:
        serializer = CartMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = merge_guest_cart(
            user=request.user,
            cart_token=serializer.validated_data["cart_token"],
        )
        return Response(_serialize_cart(request, cart))

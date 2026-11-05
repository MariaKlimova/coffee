"""Proof-authorized buyer reads/actions; public guest GET is not authority."""

from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.buyer_actions import (
    authorize_buyer,
    cancel_by_buyer,
    lock_order,
    request_cancellation,
)
from apps.orders.buyer_serializers import (
    BuyerActionResponseSerializer,
    BuyerActionsSerializer,
    BuyerCancellationRequestSerializer,
    BuyerCancelRequestSerializer,
    GuestCheckoutRecoveryResponseSerializer,
    GuestCheckoutRecoverySerializer,
)
from apps.orders.guest_access import ACTION_TOKEN_HEADER, recover_guest_checkout
from apps.orders.manage_serializers import OrderTransitionErrorSerializer

ACTION_PROOF_PARAM = OpenApiParameter(
    ACTION_TOKEN_HEADER,
    str,
    location=OpenApiParameter.HEADER,
    description="Private guest order action proof; never put it in a URL.",
)


BUYER_AUTH_DESCRIPTION = (
    "Requires an active persisted account owner authenticated with JWT, or an "
    "anonymous guest with the dedicated X-Order-Action-Token header. JWT is "
    "optional because guest proof is supported; the anonymous security alternative "
    "does not grant proof-free access. Public UUID/contact knowledge and staff "
    "status alone grant no buyer authority. Wrong or missing guest proof returns 404."
)


def private_response(data):
    response = Response(data)
    response["Cache-Control"] = "no-store"
    return response


class BuyerActionsView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Orders"],
        parameters=[ACTION_PROOF_PARAM],
        description=BUYER_AUTH_DESCRIPTION,
        responses={
            200: BuyerActionsSerializer,
            401: OrderTransitionErrorSerializer,
            404: OrderTransitionErrorSerializer,
        },
    )
    @transaction.atomic
    def get(self, request, id):
        order = lock_order(id)
        authorize_buyer(
            order,
            actor=request.user,
            token=request.headers.get(ACTION_TOKEN_HEADER, ""),
        )
        return private_response(BuyerActionsSerializer(order).data)


class BuyerCancelView(APIView):
    permission_classes = [AllowAny]
    serializer_class = BuyerCancelRequestSerializer
    operation = staticmethod(cancel_by_buyer)

    @extend_schema(
        tags=["Orders"],
        parameters=[ACTION_PROOF_PARAM],
        description=BUYER_AUTH_DESCRIPTION,
        request=BuyerCancelRequestSerializer,
        responses={
            200: BuyerActionResponseSerializer,
            400: OrderTransitionErrorSerializer,
            401: OrderTransitionErrorSerializer,
            404: OrderTransitionErrorSerializer,
            409: OrderTransitionErrorSerializer,
        },
    )
    @transaction.atomic
    def post(self, request, id):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        order, replayed = self.operation(
            order_id=id,
            actor=request.user,
            token=request.headers.get(ACTION_TOKEN_HEADER, ""),
            **serializer.validated_data,
        )
        return private_response(
            dict(
                order=BuyerActionsSerializer(order).data["order"],
                buyer_actions=BuyerActionsSerializer(order).data,
                replayed=replayed,
            )
        )


class BuyerCancellationRequestView(BuyerCancelView):
    serializer_class = BuyerCancellationRequestSerializer
    operation = staticmethod(request_cancellation)

    @extend_schema(
        tags=["Orders"],
        parameters=[ACTION_PROOF_PARAM],
        description=BUYER_AUTH_DESCRIPTION,
        request=BuyerCancellationRequestSerializer,
        responses={
            200: BuyerActionResponseSerializer,
            400: OrderTransitionErrorSerializer,
            401: OrderTransitionErrorSerializer,
            404: OrderTransitionErrorSerializer,
            409: OrderTransitionErrorSerializer,
        },
    )
    def post(self, request, id):
        return super().post(request, id)


class GuestCheckoutRecoveryView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Orders"],
        auth=[],
        description=(
            "Anonymous guest checkout recovery only; omit JWT. Requires the "
            "immutable original X-Cart-Token and retained checkout_request_id. "
            "Login never claims a guest order; an authenticated caller is "
            "rejected with 404."
        ),
        parameters=[
            OpenApiParameter(
                "X-Cart-Token", str, location=OpenApiParameter.HEADER, required=True
            )
        ],
        request=GuestCheckoutRecoverySerializer,
        responses={
            200: GuestCheckoutRecoveryResponseSerializer,
            400: OrderTransitionErrorSerializer,
            404: OrderTransitionErrorSerializer,
        },
    )
    def post(self, request):
        serializer = GuestCheckoutRecoverySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order, token = recover_guest_checkout(
            actor=request.user,
            original_cart_token=request.headers.get("X-Cart-Token"),
            **serializer.validated_data,
        )
        return private_response(
            dict(
                order=BuyerActionsSerializer(order).data["order"],
                guest_action_token=token,
                guest_action_version=order.guest_action_version,
            )
        )

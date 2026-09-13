"""Payments API: create session and provider webhook."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.serializers import (
    PaymentCreateSerializer,
    PaymentSessionSerializer,
)
from apps.payments.services import create_payment_session, handle_webhook


class PaymentCreateView(APIView):
    """POST /api/payments/create/ — start YooKassa redirect for an order."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Payments"],
        request=PaymentCreateSerializer,
        responses={201: PaymentSessionSerializer},
    )
    def post(self, request: Request) -> Response:
        serializer = PaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = create_payment_session(
            request,
            serializer.validated_data["order_id"],
        )
        return Response(
            PaymentSessionSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )


class PaymentWebhookView(APIView):
    """POST /api/payments/webhook/ — YooKassa HTTP notifications."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        tags=["Payments"],
        responses={200: dict},
    )
    def post(self, request: Request) -> Response:
        payload = request.data
        if not isinstance(payload, dict):
            return Response(
                {"detail": "Invalid payload.", "code": "validation_error"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        handle_webhook(request, payload)
        return Response({"status": "ok"})

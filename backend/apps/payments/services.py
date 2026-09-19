"""Payment session creation and YooKassa webhook handling."""

from __future__ import annotations

import ipaddress
import logging
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from uuid import UUID

from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import HttpRequest
from rest_framework.exceptions import (
    APIException,
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.request import Request

from apps.orders.access import can_view_order
from apps.orders.models import Order
from apps.payments import yookassa
from apps.payments.models import Payment

logger = logging.getLogger(__name__)


def build_payment_return_url(order_id: UUID) -> str:
    """
    Append ``order_id`` to ``YOOKASSA_RETURN_URL`` for the storefront result page.

    Preserves any existing query string on the configured base URL.
    """
    base = settings.YOOKASSA_RETURN_URL
    parsed = urlparse(base)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["order_id"] = str(order_id)
    return urlunparse(parsed._replace(query=urlencode(query)))


# https://yookassa.ru/developers/using-api/webhooks
YOOKASSA_IP_NETWORKS = (
    ipaddress.ip_network("185.71.76.0/27"),
    ipaddress.ip_network("185.71.77.0/27"),
    ipaddress.ip_network("77.75.153.0/25"),
    ipaddress.ip_network("77.75.154.128/25"),
    ipaddress.ip_network("2a02:5180::/32"),
)
YOOKASSA_IP_HOSTS = (
    ipaddress.ip_address("77.75.156.11"),
    ipaddress.ip_address("77.75.156.35"),
)

TERMINAL_STATUSES = frozenset(
    {
        Payment.Status.SUCCEEDED,
        Payment.Status.FAILED,
        Payment.Status.CANCELED,
    },
)


class PaymentProviderUnavailable(APIException):
    """YooKassa is down or returned a transport/server error (retryable)."""

    status_code = 502
    default_detail = "Payment provider is temporarily unavailable."
    default_code = "provider_unavailable"


def client_ip(request: HttpRequest) -> str | None:
    """
    Direct peer address for webhook IP checks.

    Uses ``REMOTE_ADDR`` only — never trust client-controlled
    ``X-Forwarded-For`` unless a reverse proxy strips/rewrites it to
    ``REMOTE_ADDR`` (e.g. nginx ``real_ip``).
    """
    return request.META.get("REMOTE_ADDR")


def is_yookassa_ip(ip_str: str | None) -> bool:
    """Return True if ``ip_str`` belongs to documented YooKassa networks."""
    if not ip_str:
        return False
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    if addr in YOOKASSA_IP_HOSTS:
        return True
    return any(addr in network for network in YOOKASSA_IP_NETWORKS)


def create_payment_session(request: Request, order_id: UUID) -> Payment:
    """
    Create a pending Payment via YooKassa for an accessible pending order.

    Raises NotFound if the order is missing or not visible to the caller.
    Raises ValidationError if the order is not payable.
    Raises PaymentProviderUnavailable if YooKassa is unreachable.
    """
    try:
        order = Order.objects.get(pk=order_id)
    except Order.DoesNotExist as exc:
        raise NotFound(detail="Order not found.", code="not_found") from exc

    if not can_view_order(request, order):
        raise NotFound(detail="Order not found.", code="not_found")

    if order.status != Order.Status.PENDING:
        raise ValidationError(
            {"order_id": ["Order is not awaiting payment."]},
        )

    if Payment.objects.filter(
        order=order,
        status=Payment.Status.SUCCEEDED,
    ).exists():
        raise ValidationError(
            {"order_id": ["Order already has a successful payment."]},
        )

    attempt = Payment.objects.filter(order=order).count() + 1
    idempotence_key = f"{order.id}:{attempt}"

    try:
        provider = yookassa.create_payment(
            amount=order.total_amount,
            order_id=str(order.id),
            description=f"Order {order.id}",
            return_url=build_payment_return_url(order.id),
            idempotence_key=idempotence_key,
        )
    except yookassa.YooKassaError as exc:
        raise PaymentProviderUnavailable() from exc

    provider_id = provider.get("id")
    confirmation = provider.get("confirmation") or {}
    confirmation_url = confirmation.get("confirmation_url") or ""
    if not provider_id or not confirmation_url:
        raise ValidationError(
            {
                "non_field_errors": [
                    "Payment provider returned an incomplete response.",
                ],
            },
        )

    return Payment.objects.create(
        order=order,
        provider_payment_id=str(provider_id),
        status=Payment.Status.PENDING,
        amount=order.total_amount,
        confirmation_url=confirmation_url,
        raw_payload=provider,
    )


def _map_provider_status(provider_status: str) -> str | None:
    """
    Map YooKassa payment status to our Payment.Status value.

    YooKassa uses ``canceled`` for declined/failed attempts. ``failed`` is
    reserved for local terminalization (e.g. duplicate succeeded race).
    """
    if provider_status == "succeeded":
        return Payment.Status.SUCCEEDED
    if provider_status == "canceled":
        return Payment.Status.CANCELED
    if provider_status in ("pending", "waiting_for_capture"):
        return Payment.Status.PENDING
    return None


def _apply_succeeded(payment: Payment, provider: dict[str, Any]) -> None:
    """
    Mark ``payment`` succeeded and order paid, or demote on race.

    If another payment already succeeded (or the order is already paid),
    this attempt becomes ``failed`` so the unique constraint and webhook
    retries stay healthy (HTTP 200, no IntegrityError).
    """
    order = payment.order
    already_paid = (
        order.status == Order.Status.PAID
        or Payment.objects.filter(
            order=order,
            status=Payment.Status.SUCCEEDED,
        )
        .exclude(pk=payment.pk)
        .exists()
    )
    if already_paid:
        payment.status = Payment.Status.FAILED
        payment.raw_payload = provider
        payment.save(update_fields=["status", "raw_payload", "updated_at"])
        logger.info(
            "Demoted duplicate succeeded payment %s for order %s to failed",
            payment.provider_payment_id,
            order.id,
        )
        return

    payment.status = Payment.Status.SUCCEEDED
    payment.raw_payload = provider
    try:
        with transaction.atomic():
            payment.save(update_fields=["status", "raw_payload", "updated_at"])
    except IntegrityError:
        payment.status = Payment.Status.FAILED
        payment.save(update_fields=["status", "raw_payload", "updated_at"])
        logger.info(
            "IntegrityError on succeeded payment %s; marked failed",
            payment.provider_payment_id,
        )
        return

    if order.status == Order.Status.PENDING:
        order.status = Order.Status.PAID
        order.save(update_fields=["status", "updated_at"])


def handle_webhook(request: HttpRequest, payload: dict[str, Any]) -> None:
    """
    Process a YooKassa notification after IP verification.

    Re-fetches the payment from the provider before applying status changes.
    Idempotent for already-terminal Payment rows and for a second succeeded
    attempt on the same order.
    """
    if settings.YOOKASSA_WEBHOOK_IP_CHECK:
        ip = client_ip(request)
        if not is_yookassa_ip(ip):
            logger.warning(
                "Rejected payment webhook from untrusted IP: %s",
                ip,
            )
            raise PermissionDenied(
                detail="Untrusted webhook source.",
                code="forbidden",
            )

    event_object = payload.get("object") or {}
    provider_payment_id = event_object.get("id")
    if not provider_payment_id:
        raise ValidationError(
            {"non_field_errors": ["Missing payment id in webhook payload."]},
        )

    try:
        provider = yookassa.get_payment(str(provider_payment_id))
    except yookassa.YooKassaError as exc:
        raise PaymentProviderUnavailable() from exc

    mapped = _map_provider_status(str(provider.get("status") or ""))
    if mapped is None:
        logger.info(
            "Ignoring YooKassa payment %s with status %s",
            provider_payment_id,
            provider.get("status"),
        )
        return

    with transaction.atomic():
        try:
            payment = (
                Payment.objects.select_for_update()
                .select_related("order")
                .get(provider_payment_id=str(provider_payment_id))
            )
        except Payment.DoesNotExist:
            logger.warning(
                "Webhook for unknown provider_payment_id=%s",
                provider_payment_id,
            )
            return

        if payment.status in TERMINAL_STATUSES:
            return

        if mapped == Payment.Status.SUCCEEDED:
            _apply_succeeded(payment, provider)
            return

        payment.raw_payload = provider
        payment.status = mapped
        payment.save(update_fields=["status", "raw_payload", "updated_at"])

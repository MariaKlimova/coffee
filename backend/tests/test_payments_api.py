"""Payments API tests for COFFEE-36."""

from decimal import Decimal
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.test.utils import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.payments.models import Payment
from apps.payments.yookassa import YooKassaError
from tests.helpers import auth_client

User = get_user_model()

PROVIDER_ID = "yoo-payment-test-001"
CONFIRM_URL = "https://yoomoney.ru/checkout/payments/v2/contract?orderId=test"


def _make_order(
    *, user=None, total: str = "500.00", status: str = Order.Status.PENDING
) -> Order:
    return Order.objects.create(
        user=user,
        guest_email=None if user else "guest@example.com",
        guest_phone=None if user else "+79001234567",
        delivery_address="Москва",
        status=status,
        total_amount=Decimal(total),
    )


def _mock_create_payment(monkeypatch, provider_id: str = PROVIDER_ID) -> None:
    def fake_create(**kwargs):
        return {
            "id": provider_id,
            "status": "pending",
            "amount": {"value": f"{kwargs['amount']:.2f}", "currency": "RUB"},
            "confirmation": {
                "type": "redirect",
                "confirmation_url": CONFIRM_URL,
            },
            "metadata": {"order_id": kwargs["order_id"]},
            "test": True,
        }

    monkeypatch.setattr(
        "apps.payments.yookassa.create_payment",
        fake_create,
    )


def _mock_get_payment(monkeypatch, *, provider_status: str) -> None:
    def fake_get(provider_payment_id: str):
        return {
            "id": provider_payment_id,
            "status": provider_status,
            "amount": {"value": "500.00", "currency": "RUB"},
            "paid": provider_status == "succeeded",
            "test": True,
        }

    monkeypatch.setattr("apps.payments.yookassa.get_payment", fake_get)


@pytest.mark.django_db
def test_cannot_create_payment_for_another_users_order(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    _mock_create_payment(monkeypatch)
    order = _make_order(user=user)
    other = User.objects.create_user(email="bob@example.com", password="SecurePass1")
    auth_client(api_client, other)

    response = api_client.post(
        reverse("payment-create"),
        {"order_id": str(order.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert Payment.objects.count() == 0


@pytest.mark.django_db
def test_cannot_create_payment_for_already_paid_order(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    _mock_create_payment(monkeypatch)
    order = _make_order(user=user, status=Order.Status.PAID)
    auth_client(api_client, user)

    response = api_client.post(
        reverse("payment-create"),
        {"order_id": str(order.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert Payment.objects.count() == 0


@pytest.mark.django_db
def test_cannot_create_payment_when_succeeded_exists(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    _mock_create_payment(monkeypatch)
    order = _make_order(user=user)
    Payment.objects.create(
        order=order,
        provider_payment_id="already-paid",
        status=Payment.Status.SUCCEEDED,
        amount=order.total_amount,
        confirmation_url=CONFIRM_URL,
    )
    auth_client(api_client, user)

    response = api_client.post(
        reverse("payment-create"),
        {"order_id": str(order.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert Payment.objects.count() == 1


@pytest.mark.django_db
def test_auth_user_creates_payment(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    _mock_create_payment(monkeypatch)
    order = _make_order(user=user)
    auth_client(api_client, user)

    response = api_client.post(
        reverse("payment-create"),
        {"order_id": str(order.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["order_id"] == str(order.id)
    assert body["status"] == "pending"
    assert body["amount"] == "500.00"
    assert body["payment_url"] == CONFIRM_URL
    assert Payment.objects.filter(order=order).count() == 1


@pytest.mark.django_db
def test_guest_creates_payment_for_guest_order(
    api_client: APIClient,
    monkeypatch,
) -> None:
    _mock_create_payment(monkeypatch, provider_id="guest-pay-1")
    order = _make_order(user=None)

    response = api_client.post(
        reverse("payment-create"),
        {"order_id": str(order.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["payment_url"] == CONFIRM_URL


@pytest.mark.django_db
@override_settings(YOOKASSA_WEBHOOK_IP_CHECK=True)
def test_webhook_rejects_untrusted_ip(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    order = _make_order(user=user)
    Payment.objects.create(
        order=order,
        provider_payment_id=PROVIDER_ID,
        status=Payment.Status.PENDING,
        amount=order.total_amount,
        confirmation_url=CONFIRM_URL,
    )
    _mock_get_payment(monkeypatch, provider_status="succeeded")

    response = api_client.post(
        reverse("payment-webhook"),
        {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {"id": PROVIDER_ID, "status": "succeeded"},
        },
        format="json",
        REMOTE_ADDR="203.0.113.10",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    order.refresh_from_db()
    assert order.status == Order.Status.PENDING
    payment = Payment.objects.get(provider_payment_id=PROVIDER_ID)
    assert payment.status == Payment.Status.PENDING


@pytest.mark.django_db
@override_settings(YOOKASSA_WEBHOOK_IP_CHECK=True)
def test_webhook_success_marks_order_paid(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    order = _make_order(user=user)
    Payment.objects.create(
        order=order,
        provider_payment_id=PROVIDER_ID,
        status=Payment.Status.PENDING,
        amount=order.total_amount,
        confirmation_url=CONFIRM_URL,
    )
    _mock_get_payment(monkeypatch, provider_status="succeeded")

    response = api_client.post(
        reverse("payment-webhook"),
        {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {"id": PROVIDER_ID, "status": "succeeded"},
        },
        format="json",
        REMOTE_ADDR="185.71.76.1",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "ok"
    order.refresh_from_db()
    assert order.status == Order.Status.PAID
    payment = Payment.objects.get(provider_payment_id=PROVIDER_ID)
    assert payment.status == Payment.Status.SUCCEEDED


@pytest.mark.django_db
@override_settings(YOOKASSA_WEBHOOK_IP_CHECK=False)
def test_webhook_idempotent_on_repeat(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    order = _make_order(user=user)
    Payment.objects.create(
        order=order,
        provider_payment_id=PROVIDER_ID,
        status=Payment.Status.PENDING,
        amount=order.total_amount,
        confirmation_url=CONFIRM_URL,
    )
    _mock_get_payment(monkeypatch, provider_status="succeeded")
    payload = {
        "type": "notification",
        "event": "payment.succeeded",
        "object": {"id": PROVIDER_ID, "status": "succeeded"},
    }

    first = api_client.post(reverse("payment-webhook"), payload, format="json")
    second = api_client.post(reverse("payment-webhook"), payload, format="json")

    assert first.status_code == status.HTTP_200_OK
    assert second.status_code == status.HTTP_200_OK
    assert (
        Payment.objects.filter(
            order=order,
            status=Payment.Status.SUCCEEDED,
        ).count()
        == 1
    )
    order.refresh_from_db()
    assert order.status == Order.Status.PAID


@pytest.mark.django_db
@override_settings(YOOKASSA_WEBHOOK_IP_CHECK=False)
def test_webhook_canceled_keeps_order_pending(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    order = _make_order(user=user)
    Payment.objects.create(
        order=order,
        provider_payment_id=PROVIDER_ID,
        status=Payment.Status.PENDING,
        amount=order.total_amount,
        confirmation_url=CONFIRM_URL,
    )
    _mock_get_payment(monkeypatch, provider_status="canceled")

    response = api_client.post(
        reverse("payment-webhook"),
        {
            "type": "notification",
            "event": "payment.canceled",
            "object": {"id": PROVIDER_ID, "status": "canceled"},
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    order.refresh_from_db()
    assert order.status == Order.Status.PENDING
    payment = Payment.objects.get(provider_payment_id=PROVIDER_ID)
    assert payment.status == Payment.Status.CANCELED


@pytest.mark.django_db
def test_anonymous_cannot_pay_user_owned_order(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    _mock_create_payment(monkeypatch)
    order = _make_order(user=user)

    response = api_client.post(
        reverse("payment-create"),
        {"order_id": str(order.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert Payment.objects.count() == 0


@pytest.mark.django_db
def test_create_payment_unknown_order(
    api_client: APIClient,
    monkeypatch,
) -> None:
    _mock_create_payment(monkeypatch)

    response = api_client.post(
        reverse("payment-create"),
        {"order_id": str(uuid4())},
        format="json",
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
@override_settings(YOOKASSA_WEBHOOK_IP_CHECK=True)
def test_webhook_ignores_spoofed_x_forwarded_for(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    order = _make_order(user=user)
    Payment.objects.create(
        order=order,
        provider_payment_id=PROVIDER_ID,
        status=Payment.Status.PENDING,
        amount=order.total_amount,
        confirmation_url=CONFIRM_URL,
    )
    _mock_get_payment(monkeypatch, provider_status="succeeded")

    response = api_client.post(
        reverse("payment-webhook"),
        {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {"id": PROVIDER_ID, "status": "succeeded"},
        },
        format="json",
        REMOTE_ADDR="203.0.113.10",
        HTTP_X_FORWARDED_FOR="185.71.76.1",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    order.refresh_from_db()
    assert order.status == Order.Status.PENDING


@pytest.mark.django_db
@override_settings(YOOKASSA_WEBHOOK_IP_CHECK=False)
def test_webhook_second_succeeded_payment_demoted_to_failed(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    order = _make_order(user=user)
    Payment.objects.create(
        order=order,
        provider_payment_id="pay-first",
        status=Payment.Status.PENDING,
        amount=order.total_amount,
        confirmation_url=CONFIRM_URL,
    )
    Payment.objects.create(
        order=order,
        provider_payment_id="pay-second",
        status=Payment.Status.PENDING,
        amount=order.total_amount,
        confirmation_url=CONFIRM_URL,
    )

    def fake_get(provider_payment_id: str):
        return {
            "id": provider_payment_id,
            "status": "succeeded",
            "amount": {"value": "500.00", "currency": "RUB"},
            "paid": True,
            "test": True,
        }

    monkeypatch.setattr("apps.payments.yookassa.get_payment", fake_get)

    first = api_client.post(
        reverse("payment-webhook"),
        {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {"id": "pay-first", "status": "succeeded"},
        },
        format="json",
    )
    second = api_client.post(
        reverse("payment-webhook"),
        {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {"id": "pay-second", "status": "succeeded"},
        },
        format="json",
    )

    assert first.status_code == status.HTTP_200_OK
    assert second.status_code == status.HTTP_200_OK
    order.refresh_from_db()
    assert order.status == Order.Status.PAID
    assert Payment.objects.get(provider_payment_id="pay-first").status == (
        Payment.Status.SUCCEEDED
    )
    assert Payment.objects.get(provider_payment_id="pay-second").status == (
        Payment.Status.FAILED
    )
    assert (
        Payment.objects.filter(
            order=order,
            status=Payment.Status.SUCCEEDED,
        ).count()
        == 1
    )


@pytest.mark.django_db
@override_settings(YOOKASSA_WEBHOOK_IP_CHECK=False)
def test_webhook_provider_outage_returns_502(
    api_client: APIClient,
    user,
    monkeypatch,
) -> None:
    order = _make_order(user=user)
    Payment.objects.create(
        order=order,
        provider_payment_id=PROVIDER_ID,
        status=Payment.Status.PENDING,
        amount=order.total_amount,
        confirmation_url=CONFIRM_URL,
    )

    def boom(_provider_payment_id: str):
        raise YooKassaError("unreachable")

    monkeypatch.setattr("apps.payments.yookassa.get_payment", boom)

    response = api_client.post(
        reverse("payment-webhook"),
        {
            "type": "notification",
            "event": "payment.succeeded",
            "object": {"id": PROVIDER_ID, "status": "succeeded"},
        },
        format="json",
    )

    assert response.status_code == status.HTTP_502_BAD_GATEWAY
    order.refresh_from_db()
    assert order.status == Order.Status.PENDING

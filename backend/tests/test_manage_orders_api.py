"""Staff order reads against PostgreSQL, including privacy and bounded queries."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment
from tests.helpers import auth_client

pytestmark = pytest.mark.django_db
LIST = "/api/manage/orders/"


@pytest.fixture
def staff_client(api_client):
    staff = get_user_model().objects.create_user(
        email="staff-orders@example.test", password="SyntheticPass59", is_staff=True
    )
    auth_client(api_client, staff)
    return api_client


@pytest.fixture
def orders(user):
    user.phone = "+7 (900) 123-45-67"
    user.save(update_fields=["phone"])
    owned = Order.objects.create(
        user=user, delivery_address="Synthetic account address", total_amount="750.00"
    )
    guest = Order.objects.create(
        guest_email="Guest59@example.test",
        guest_phone="+7 (911) 765-43-21",
        delivery_address="Synthetic guest address",
        total_amount="500.00",
        status=Order.Status.PAYMENT_REVIEW,
        stock_review_reason="payment_after_reservation_release",
    )
    return owned, guest


@pytest.mark.parametrize("actor, expected", [("guest", 401), ("buyer", 403)])
def test_permissions_cover_list_detail_head_and_options(
    api_client, user, orders, actor, expected
):
    if actor == "buyer":
        auth_client(api_client, user)
    for path in (LIST, f"{LIST}{orders[1].pk}/"):
        for method in ("get", "head", "options"):
            assert getattr(api_client, method)(path).status_code == expected


def test_staff_finds_both_types_and_minimal_contacts(staff_client, orders):
    response = staff_client.get(LIST)
    assert response.status_code == 200
    rows = {row["id"]: row for row in response.data["results"]}
    assert set(rows) == {str(order.pk) for order in orders}
    assert rows[str(orders[0].pk)]["customer_email"] == "alice@example.com"
    assert rows[str(orders[1].pk)]["customer_phone"] == "+7 (911) 765-43-21"
    assert rows[str(orders[1].pk)]["status"] == "payment_review"
    assert "delivery_address" not in rows[str(orders[1].pk)]
    assert "payments" not in rows[str(orders[1].pk)]


def test_latest_payment_status_is_null_without_attempts(staff_client, orders):
    response = staff_client.get(LIST)
    assert all(row["latest_payment_status"] is None for row in response.data["results"])
    detail = staff_client.get(f"{LIST}{orders[1].pk}/")
    assert detail.data["status"] == "payment_review"
    assert detail.data["latest_payment_status"] is None


@pytest.mark.parametrize(
    "older_status, latest_status",
    [
        ("succeeded", "pending"),
        ("canceled", "succeeded"),
        ("canceled", "failed"),
        ("pending", "canceled"),
    ],
)
def test_latest_attempt_status_is_not_aggregate_or_order_status(
    staff_client, orders, older_status, latest_status
):
    order = orders[0]
    Order.objects.filter(pk=order.pk).update(status=Order.Status.PAID)
    older = Payment.objects.create(
        order=order,
        provider_payment_id="synthetic-older-59",
        status=older_status,
        amount="750.00",
    )
    latest = Payment.objects.create(
        order=order,
        provider_payment_id="synthetic-latest-59",
        status=latest_status,
        amount="750.00",
        confirmation_url="https://example.test/private-token",
        raw_payload={"private_provider_payload": "private-synthetic-marker"},
    )
    Payment.objects.filter(pk=older.pk).update(
        created_at=datetime(2026, 1, 1, tzinfo=UTC)
    )
    Payment.objects.filter(pk=latest.pk).update(
        created_at=datetime(2026, 1, 2, tzinfo=UTC)
    )
    response = staff_client.get(LIST, {"search": str(order.pk)})
    row = response.data["results"][0]
    assert row["status"] == "paid"
    assert row["latest_payment_status"] == latest_status
    assert (
        staff_client.get(f"{LIST}{order.pk}/").data["latest_payment_status"]
        == latest_status
    )
    for forbidden in (
        "provider_payment_id",
        "confirmation_url",
        "raw_payload",
        "private_provider_payload",
        "private-synthetic-marker",
        "private-token",
    ):
        assert forbidden not in response.content.decode()
    # The buyer contract remains independent of staff payment projections.
    assert (
        "latest_payment_status" not in staff_client.get(f"/api/orders/{order.pk}/").data
    )
    assert (
        "latest_payment_status" not in staff_client.get("/api/orders/").content.decode()
    )


def test_latest_attempt_timestamp_ties_use_descending_uuid(staff_client, orders):
    order = orders[0]
    low = Payment.objects.create(
        id=uuid.UUID(int=1),
        order=order,
        provider_payment_id="synthetic-low-59",
        status="pending",
        amount="750.00",
    )
    high = Payment.objects.create(
        id=uuid.UUID(int=2),
        order=order,
        provider_payment_id="synthetic-high-59",
        status="canceled",
        amount="750.00",
    )
    Payment.objects.filter(pk__in=[low.pk, high.pk]).update(
        created_at=datetime(2026, 1, 1, tzinfo=UTC)
    )
    row = staff_client.get(LIST, {"search": str(order.pk)}).data["results"][0]
    assert row["latest_payment_status"] == "canceled"
    detail = staff_client.get(f"{LIST}{order.pk}/").data
    assert detail["payments"][0]["id"] == str(high.pk)
    assert detail["latest_payment_status"] == detail["payments"][0]["status"]


@pytest.mark.parametrize(
    "search,index",
    [
        ("ALICE@EXAMPLE", 0),
        ("guest59@", 1),
        ("9001234567", 0),
        ("+7 (911)", 1),
        ("7654321", 1),
        ("does-not-exist", None),
    ],
)
def test_search_contacts(staff_client, orders, search, index):
    response = staff_client.get(LIST, {"search": search})
    assert response.status_code == 200
    assert [row["id"] for row in response.data["results"]] == (
        [] if index is None else [str(orders[index].pk)]
    )


@pytest.mark.parametrize("hyphens", [True, False])
def test_search_uuid_and_partial_order_number(staff_client, orders, hyphens):
    value = str(orders[0].pk) if hyphens else orders[0].pk.hex
    for search in (value, value[:8]):
        response = staff_client.get(LIST, {"search": search})
        assert response.status_code == 200
        assert [row["id"] for row in response.data["results"]] == [str(orders[0].pk)]


def test_filters_combine_and_include_full_utc_calendar_day(staff_client, orders):
    for order, hour, microsecond in ((orders[0], 0, 0), (orders[1], 23, 999999)):
        Order.objects.filter(pk=order.pk).update(
            created_at=datetime(
                2026,
                11,
                3,
                hour,
                59 if hour else 0,
                59 if hour else 0,
                microsecond,
                tzinfo=UTC,
            )
        )
    response = staff_client.get(
        LIST, {"date_from": "2026-11-03", "date_to": "2026-11-03"}
    )
    assert response.data["count"] == 2
    response = staff_client.get(
        LIST,
        {
            "date_from": "2026-11-03",
            "date_to": "2026-11-03",
            "status": "payment_review",
            "search": "guest59",
        },
    )
    assert [row["id"] for row in response.data["results"]] == [str(orders[1].pk)]
    assert staff_client.get(LIST, {"date_to": "2026-11-02"}).data["count"] == 0
    assert staff_client.get(LIST, {"date_from": "2026-11-04"}).data["count"] == 0


@pytest.mark.parametrize(
    "params,field",
    [
        ({"status": "unknown"}, "status"),
        ({"date_from": "2026-02-30"}, "date_from"),
        ({"date_to": "2026-1-1"}, "date_to"),
        ({"date_to": "2026-11-03T00:00:00Z"}, "date_to"),
        ({"date_from": "2026-11-04", "date_to": "2026-11-03"}, "date_to"),
        ({"search": "a" * 256}, "search"),
    ],
)
def test_invalid_filters_are_structured_400(staff_client, params, field):
    response = staff_client.get(LIST, params)
    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert field in response.data["errors"]


def test_extreme_valid_dates_do_not_overflow(staff_client, orders):
    response = staff_client.get(
        LIST, {"date_from": "0001-01-01", "date_to": "9999-12-31"}
    )
    assert response.status_code == 200
    assert response.data["count"] == 2


def test_stable_tie_order_and_pagination(staff_client, orders):
    Order.objects.all().update(created_at=datetime(2026, 11, 3, tzinfo=UTC))
    expected = sorted([str(order.pk) for order in orders], reverse=True)
    pages = [staff_client.get(LIST, {"page": page, "page_size": 1}) for page in (1, 2)]
    assert [response.data["results"][0]["id"] for response in pages] == expected
    assert pages[0].data["count"] == 2
    assert pages[0].data["next"] and pages[1].data["previous"]
    assert staff_client.get(LIST, {"page": 3, "page_size": 1}).status_code == 404
    assert staff_client.get(LIST, {"search": "  "}).data["count"] == 2


def test_history_and_allowlisted_payments_survive_catalog_deletion(
    staff_client, orders, products
):
    order = orders[0]
    product = products["cheap"]
    OrderItem.objects.create(
        order=order,
        product=product,
        product_name="Historical coffee",
        product_price=Decimal("375.00"),
        quantity=2,
    )
    product.name = "New catalog name"
    product.price = Decimal("999.00")
    product.save()
    product.delete()
    for status in (Payment.Status.CANCELED, Payment.Status.SUCCEEDED):
        Payment.objects.create(
            order=order,
            provider_payment_id=f"provider-secret-{status}",
            status=status,
            amount="750.00",
            confirmation_url="https://example.test/secret-payment-token",
            raw_payload={"secret": "provider-raw-marker", "customer": "private-marker"},
        )
    response = staff_client.get(f"{LIST}{order.pk}/")
    assert response.status_code == 200
    body = response.data
    assert body["total"] == "750.00"
    assert body["delivery_address"] == "Synthetic account address"
    assert body["items"][0]["product_id"] is None
    assert body["items"][0]["product_name"] == "Historical coffee"
    assert body["items"][0]["product_price"] == "375.00"
    assert len(body["payments"]) == 2
    for payment in body["payments"]:
        assert set(payment) == {"id", "status", "amount", "created_at", "updated_at"}
        assert payment["amount"] == "750.00"
    serialized = response.content.decode()
    for marker in (
        "raw_payload",
        "provider_payment_id",
        "confirmation_url",
        "password",
        "provider-secret",
        "provider-raw-marker",
        "private-marker",
        "secret-payment-token",
    ):
        assert marker not in serialized


def test_empty_history_missing_contacts_and_unknown_id(staff_client):
    order = Order.objects.create(
        delivery_address="Legacy synthetic address", total_amount="0.00"
    )
    response = staff_client.get(f"{LIST}{order.pk}/")
    assert response.status_code == 200
    assert response.data["items"] == [] and response.data["payments"] == []
    assert (
        response.data["customer_email"] is None
        and response.data["customer_phone"] is None
    )
    assert staff_client.get(f"{LIST}{uuid.uuid4()}/").data["code"] == "not_found"


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_manage_api_cannot_change_orders(staff_client, orders, method):
    for path in (LIST, f"{LIST}{orders[0].pk}/"):
        response = getattr(staff_client, method)(
            path, {"status": "cancelled"}, format="json"
        )
        assert response.status_code == 405
    orders[0].refresh_from_db()
    assert orders[0].status == "pending"


def test_buyer_access_rules_stay_unchanged(staff_client, orders, user):
    assert staff_client.get("/api/orders/").data["count"] == 0
    buyer = APIClient()
    auth_client(buyer, user)
    assert buyer.get("/api/orders/").data["count"] == 1
    assert buyer.get(f"/api/orders/{orders[0].pk}/").status_code == 200
    guest = APIClient()
    assert guest.get(f"/api/orders/{orders[0].pk}/").status_code == 404
    assert guest.get(f"/api/orders/{orders[1].pk}/").status_code == 200
    stranger = get_user_model().objects.create_user(email="stranger59@example.test")
    auth_client(buyer, stranger)
    assert buyer.get(f"/api/orders/{orders[0].pk}/").status_code == 404


def test_bounded_queries_and_no_read_side_effects(staff_client, orders):
    def count_queries(path):
        with CaptureQueriesContext(connection) as queries:
            assert staff_client.get(path).status_code == 200
        assert all(
            query["sql"].lstrip().upper().startswith("SELECT") for query in queries
        )
        return len(queries)

    list_before = count_queries(LIST)
    detail_before = count_queries(f"{LIST}{orders[0].pk}/")
    for index in range(12):
        customer = get_user_model().objects.create_user(
            email=f"scale59-{index}@example.test"
        )
        Order.objects.create(
            user=customer, delivery_address="Synthetic", total_amount="1.00"
        )
        OrderItem.objects.create(
            order=orders[0],
            product_name=f"Snapshot {index}",
            product_price="1.00",
            quantity=1,
        )
        Payment.objects.create(
            order=orders[0], provider_payment_id=f"synthetic59-{index}", amount="1.00"
        )
    assert count_queries(LIST) == list_before <= 3
    assert count_queries(f"{LIST}{orders[0].pk}/") == detail_before <= 4

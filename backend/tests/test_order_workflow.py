"""COFFEE-61 domain/API behavior with real PostgreSQL locks and synthetic money."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import RequestFactory
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied

from apps.cart.models import Cart, CartItem
from apps.catalog.models import Product
from apps.orders.models import Order, OrderStatusTransition
from apps.orders.services import create_order_from_cart, expire_stock_reservations
from apps.orders.workflow import (
    OrderTransitionConflict,
    allowed_order_transitions,
    transition_order,
)
from apps.payments.models import Payment
from apps.payments.services import handle_webhook

pytestmark = pytest.mark.django_db


@pytest.fixture
def staff():
    return get_user_model().objects.create_user(
        email="workflow-staff@example.test", is_staff=True
    )


@pytest.fixture
def purchase(products):
    product = products["cheap"]
    Product.objects.filter(pk=product.pk).update(stock_quantity=5)
    cart = Cart.objects.create(cart_token=uuid4())
    CartItem.objects.create(cart=cart, product=product, quantity=2)
    order = create_order_from_cart(
        cart=cart,
        user=None,
        delivery_address="Synthetic workflow address",
        guest_email="workflow-buyer@example.test",
        guest_phone="+70000000000",
    )
    payment = Payment.objects.create(
        order=order,
        amount=order.total_amount,
        provider_payment_id=f"synthetic-workflow-{uuid4()}",
        raw_payload={"private_marker": "synthetic-provider-PII"},
    )
    return order, product, payment


@pytest.fixture
def confirm(monkeypatch, settings):
    settings.YOOKASSA_WEBHOOK_IP_CHECK = False

    def provider(provider_id):
        payment = Payment.objects.get(provider_payment_id=provider_id)
        return {
            "id": provider_id,
            "status": "succeeded",
            "paid": True,
            "test": True,
            "amount": {"value": str(payment.amount), "currency": "RUB"},
            "private_marker": "synthetic-provider-PII",
        }

    monkeypatch.setattr("apps.payments.yookassa.get_payment", provider)

    def apply(payment):
        handle_webhook(
            RequestFactory().post("/api/payments/webhook/"),
            {"object": {"id": payment.provider_payment_id}},
        )

    return apply


def stock(product):
    product.refresh_from_db()
    return product.stock_quantity, product.reserved_quantity, product.available_quantity


def apply(order, staff, to_status, **kwargs):
    return transition_order(
        order_id=order.pk,
        actor=staff,
        expected_status=kwargs.pop("expected_status", order.status),
        to_status=to_status,
        request_id=kwargs.pop("request_id", uuid4()),
        **kwargs,
    )


def race(*operations):
    assert connection.vendor == "postgresql", "Workflow races require PostgreSQL"
    barrier = Barrier(len(operations), timeout=10)

    def worker(operation):
        close_old_connections()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout = '8s'")
            barrier.wait()
            try:
                return operation()
            except APIException as exc:
                return exc
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=len(operations)) as pool:
        futures = [pool.submit(worker, operation) for operation in operations]
        return [future.result(timeout=20) for future in futures]


@pytest.mark.parametrize(
    "status,state,targets,effect,reason",
    [
        ("pending", "active", ["cancelled"], "release_reservation", None),
        ("pending", "none", ["cancelled"], "none", "legacy_uncounted"),
        ("pending", "released", ["cancelled"], "none", None),
        ("paid", "consumed", ["processing", "cancelled"], "restore_stock", None),
        ("paid", "none", ["processing", "cancelled"], "none", "legacy_uncounted"),
        ("processing", "consumed", ["shipped", "cancelled"], "restore_stock", None),
        ("processing", "none", ["shipped", "cancelled"], "none", "legacy_uncounted"),
        ("shipped", "consumed", ["delivered"], "none", None),
        ("delivered", "consumed", [], None, None),
        ("cancelled", "restored", [], None, None),
        ("payment_review", "released", [], None, None),
        ("paid", "released", ["processing"], "none", None),
    ],
)
def test_metadata_matrix(status, state, targets, effect, reason):
    order = Order.objects.create(
        status=status,
        reservation_state=state,
        delivery_address="Synthetic",
        total_amount="1.00",
    )
    actions = allowed_order_transitions(order)
    assert [action["to_status"] for action in actions] == targets
    if actions:
        assert actions[-1]["inventory_effect"] == effect
        assert actions[-1]["inventory_reason"] == reason


def test_pending_with_successful_payment_never_offers_or_performs_cancel(
    purchase, staff
):
    order, product, payment = purchase
    Payment.objects.filter(pk=payment.pk).update(status="succeeded")
    assert allowed_order_transitions(order) == []
    with pytest.raises(OrderTransitionConflict):
        apply(order, staff, "cancelled")
    assert stock(product) == (5, 2, 3)


def test_complete_lifecycle_preserves_money_and_records_real_history(
    purchase, staff, confirm
):
    order, product, payment = purchase
    confirm(payment)
    order.refresh_from_db()
    original_money = list(Payment.objects.filter(pk=payment.pk).values())
    for target in ("processing", "shipped", "delivered"):
        order, replayed = apply(order, staff, target, comment="  Проверила заказ  ")
        assert replayed is False
        confirm(payment)
        order.refresh_from_db()
        assert order.status == target
        assert stock(product) == (3, 0, 3)
    events = list(order.status_history.all())
    assert [(event.from_status, event.to_status) for event in events] == [
        ("pending", "paid"),
        ("paid", "processing"),
        ("processing", "shipped"),
        ("shipped", "delivered"),
    ]
    assert events[0].source == "payment" and events[0].actor_id is None
    assert all(event.actor_id == staff.pk for event in events[1:])
    assert all(event.comment == "Проверила заказ" for event in events[1:])
    assert list(Payment.objects.filter(pk=payment.pk).values()) == original_money


@pytest.mark.parametrize("status", ["processing", "shipped", "delivered", "cancelled"])
def test_duplicate_payment_attempt_cannot_roll_back_workflow(
    purchase, staff, confirm, status
):
    order, product, payment = purchase
    confirm(payment)
    order.refresh_from_db()
    for target in ("processing", "shipped", "delivered"):
        if status == "cancelled":
            order, _ = apply(order, staff, "cancelled")
            break
        order, _ = apply(order, staff, target)
        if target == status:
            break
    inventory = stock(product)
    history = list(order.status_history.values())
    duplicate = Payment.objects.create(
        order=order,
        amount=order.total_amount,
        provider_payment_id=f"duplicate-{uuid4()}",
    )
    confirm(duplicate)
    confirm(payment)
    order.refresh_from_db()
    duplicate.refresh_from_db()
    assert order.status == status and stock(product) == inventory
    assert duplicate.status == "failed"
    assert list(order.status_history.values()) == history


@pytest.mark.parametrize("status", ["processing", "shipped", "delivered"])
def test_first_confirmed_legacy_payment_never_rewinds_fulfillment(
    staff, confirm, status
):
    order = Order.objects.create(
        status=status, total_amount="5.00", delivery_address="Legacy"
    )
    payment = Payment.objects.create(
        order=order, amount="5.00", provider_payment_id=f"legacy-{uuid4()}"
    )
    confirm(payment)
    order.refresh_from_db()
    payment.refresh_from_db()
    assert order.status == status and order.reservation_state == "none"
    assert payment.status == "succeeded" and order.status_history.count() == 0


@pytest.mark.parametrize("processing", [False, True])
def test_paid_cancellation_restores_once_and_preserves_other_reserves(
    purchase, staff, confirm, processing
):
    order, product, payment = purchase
    confirm(payment)
    order.refresh_from_db()
    if processing:
        order, _ = apply(order, staff, "processing")
    # A different buyer holds one of the remaining three units.
    cart = Cart.objects.create(cart_token=uuid4())
    CartItem.objects.create(cart=cart, product=product, quantity=1)
    other = create_order_from_cart(cart=cart, user=None, delivery_address="Other buyer")
    money_before = list(Payment.objects.filter(pk=payment.pk).values())
    request_id, expected = uuid4(), order.status
    order, _ = apply(order, staff, "cancelled", request_id=request_id)
    assert order.reservation_state == "restored" and stock(product) == (5, 1, 4)
    again, replayed = apply(
        order, staff, "cancelled", request_id=request_id, expected_status=expected
    )
    assert replayed and again.status == "cancelled"
    assert stock(product) == (5, 1, 4)
    other.refresh_from_db()
    assert other.reservation_state == "active"
    assert list(Payment.objects.filter(pk=payment.pk).values()) == money_before


def test_unpaid_cancel_replay_and_late_money_are_visible_without_double_stock(
    purchase, staff, confirm
):
    order, product, payment = purchase
    request_id = uuid4()
    order, _ = apply(
        order, staff, "cancelled", request_id=request_id, comment="  Отмена  "
    )
    assert order.reservation_state == "released" and stock(product) == (5, 0, 5)
    _, replayed = apply(
        order,
        staff,
        "cancelled",
        expected_status="pending",
        request_id=request_id,
        comment="Отмена",
    )
    assert replayed
    confirm(payment)
    order.refresh_from_db()
    payment.refresh_from_db()
    assert order.status == "payment_review" and payment.status == "succeeded"
    assert stock(product) == (5, 0, 5)
    assert [
        (event.from_status, event.to_status, event.source)
        for event in order.status_history.all()
    ] == [("pending", "cancelled", "staff"), ("cancelled", "payment_review", "payment")]
    latest, replayed = apply(
        order,
        staff,
        "cancelled",
        expected_status="pending",
        request_id=request_id,
        comment="Отмена",
    )
    assert latest.status == "payment_review" and replayed
    assert order.status_history.count() == 2


@pytest.mark.parametrize("status", ["paid", "processing"])
def test_legacy_paid_cancel_has_no_fabricated_inventory(staff, products, status):
    order = Order.objects.create(
        status=status, delivery_address="Legacy", total_amount="500.00"
    )
    product = products["cheap"]
    before = stock(product)
    order, _ = apply(order, staff, "cancelled")
    assert order.status == "cancelled" and order.reservation_state == "none"
    assert stock(product) == before and order.stock_lines.count() == 0


@pytest.mark.parametrize("status", ["paid", "processing"])
def test_first_legacy_payment_after_paid_cancellation_keeps_cancelled(
    staff, products, confirm, status
):
    order = Order.objects.create(
        status=status, total_amount="5.00", delivery_address="Legacy"
    )
    payment = Payment.objects.create(
        order=order, amount="5.00", provider_payment_id=f"legacy-cancel-{uuid4()}"
    )
    before = stock(products["cheap"])
    order, _ = apply(order, staff, "cancelled")
    confirm(payment)
    confirm(payment)
    order.refresh_from_db()
    payment.refresh_from_db()
    assert order.status == "cancelled" and order.reservation_state == "none"
    assert payment.status == "succeeded" and order.status_history.count() == 1
    assert stock(products["cheap"]) == before


def test_staff_snapshot_survives_deleted_account_without_email(
    api_client, staff, purchase
):
    order, _, _ = purchase
    key, label = uuid4(), f"Сотрудник #{staff.pk}"
    apply(order, staff, "cancelled", request_id=key)
    staff.delete()
    other = get_user_model().objects.create_user(
        email="replacement@example.test", is_staff=True
    )
    api_client.force_authenticate(other)
    detail = api_client.get(f"/api/manage/orders/{order.pk}/").data
    assert detail["status_history"][0]["actor"] == {"id": None, "label": label}
    with pytest.raises(OrderTransitionConflict) as failure:
        apply(order, other, "cancelled", expected_status="pending", request_id=key)
    assert failure.value.detail.code == "idempotency_conflict"


def test_request_key_conflicts_and_later_replay_return_current_state(
    purchase, staff, confirm
):
    order, _, payment = purchase
    confirm(payment)
    order.refresh_from_db()
    key = uuid4()
    order, _ = apply(order, staff, "processing", request_id=key, comment=" Ready ")
    other = get_user_model().objects.create_user(
        email="other-staff@example.test", is_staff=True
    )
    for actor, comment, target in [
        (staff, "Changed", "processing"),
        (other, "Ready", "processing"),
        (staff, "Ready", "cancelled"),
    ]:
        with pytest.raises(OrderTransitionConflict) as failure:
            apply(
                order,
                actor,
                target,
                request_id=key,
                expected_status="paid",
                comment=comment,
            )
        assert failure.value.detail.code == "idempotency_conflict"
    order, _ = apply(order, staff, "shipped")
    current, replayed = apply(
        order,
        staff,
        "processing",
        expected_status="paid",
        request_id=key,
        comment="Ready",
    )
    assert (
        replayed and current.status == "shipped" and order.status_history.count() == 3
    )
    with pytest.raises(OrderTransitionConflict) as failure:
        apply(order, staff, "processing", expected_status="paid")
    assert failure.value.detail.code == "order_status_conflict"


@pytest.mark.parametrize(
    "status,target",
    [
        ("pending", "paid"),
        ("paid", "delivered"),
        ("shipped", "cancelled"),
        ("delivered", "processing"),
        ("cancelled", "processing"),
        ("payment_review", "processing"),
    ],
)
def test_invalid_edges_do_not_write(staff, status, target):
    order = Order.objects.create(
        status=status, delivery_address="Synthetic", total_amount="1.00"
    )
    before = list(Order.objects.filter(pk=order.pk).values())
    with pytest.raises(OrderTransitionConflict) as failure:
        apply(order, staff, target)
    assert failure.value.detail.code == "transition_not_allowed"
    assert list(Order.objects.filter(pk=order.pk).values()) == before
    assert OrderStatusTransition.objects.count() == 0


def test_expiry_audit_is_exactly_once(purchase):
    order, product, _ = purchase
    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timedelta(seconds=1)
    )
    assert expire_stock_reservations() == 1
    assert expire_stock_reservations() == 0
    event = order.status_history.get()
    assert (event.from_status, event.to_status, event.source, event.actor_id) == (
        "pending",
        "cancelled",
        "reservation_expiry",
        None,
    )
    assert stock(product) == (5, 0, 5)


def test_history_failure_rolls_back_order_and_returned_stock(
    purchase, staff, confirm, monkeypatch
):
    order, product, payment = purchase
    confirm(payment)
    order.refresh_from_db()
    before = list(Order.objects.filter(pk=order.pk).values())
    money = list(Payment.objects.filter(pk=payment.pk).values())

    def fail(*args, **kwargs):
        raise RuntimeError("Synthetic audit persistence failure")

    monkeypatch.setattr("apps.orders.workflow.record_status_transition", fail)
    with pytest.raises(RuntimeError):
        apply(order, staff, "cancelled")
    assert list(Order.objects.filter(pk=order.pk).values()) == before
    assert list(Payment.objects.filter(pk=payment.pk).values()) == money
    assert stock(product) == (3, 0, 3) and order.status_history.count() == 1


def test_payment_audit_failure_rolls_back_money_order_and_stock(
    purchase, confirm, monkeypatch
):
    order, product, payment = purchase

    def fail(*args, **kwargs):
        raise RuntimeError("Synthetic payment audit failure")

    monkeypatch.setattr("apps.orders.services.record_status_transition", fail)
    with pytest.raises(RuntimeError):
        confirm(payment)
    order.refresh_from_db()
    payment.refresh_from_db()
    assert order.status == "pending" and payment.status == "pending"
    assert stock(product) == (5, 2, 3) and order.status_history.count() == 0


@pytest.mark.parametrize("flag", ["is_active", "is_staff"])
def test_service_rechecks_persisted_staff_permissions(purchase, staff, flag):
    order, product, _ = purchase
    get_user_model().objects.filter(pk=staff.pk).update(**{flag: False})
    with pytest.raises(PermissionDenied):
        apply(order, staff, "cancelled")
    assert stock(product) == (5, 2, 3) and order.status_history.count() == 0


@pytest.mark.parametrize("actor,code", [("guest", 401), ("buyer", 403), ("staff", 200)])
def test_transition_api_permissions_and_staff_projection(
    api_client, user, staff, purchase, actor, code
):
    order, _, _ = purchase
    if actor != "guest":
        api_client.force_authenticate(staff if actor == "staff" else user)
    response = api_client.post(
        f"/api/manage/orders/{order.pk}/transitions/",
        {
            "expected_status": "pending",
            "to_status": "cancelled",
            "request_id": str(uuid4()),
            "comment": "<b>Plain text</b>",
        },
        format="json",
    )
    assert response.status_code == code
    if code == 200:
        body = response.json()
        assert set(body) == {"order", "replayed"} and body["replayed"] is False
        event = body["order"]["status_history"][0]
        assert event["actor"] == {
            "id": str(staff.pk),
            "label": f"Сотрудник #{staff.pk}",
        }
        assert (
            event["comment"] == "<b>Plain text</b>"
            and body["order"]["allowed_transitions"] == []
        )
        for marker in (
            "request_id",
            "actor_label",
            "private_marker",
            "synthetic-provider-PII",
            staff.email,
        ):
            assert marker not in response.content.decode()
        assert (
            "status_history"
            not in api_client.get("/api/manage/orders/").data["results"][0]
        )
        buyer_detail = api_client.get(f"/api/orders/{order.pk}/").data
        assert (
            "status_history" not in buyer_detail
            and "allowed_transitions" not in buyer_detail
        )


@pytest.mark.parametrize(
    "update",
    [
        {"request_id": "bad"},
        {"expected_status": "bad"},
        {"comment": "x" * 501},
        {"comment": None},
        {"amount": "0.01"},
        {"status": "paid"},
    ],
)
def test_api_input_errors_do_not_mutate(api_client, staff, purchase, update):
    order, product, _ = purchase
    api_client.force_authenticate(staff)
    body = {
        "expected_status": "pending",
        "to_status": "cancelled",
        "request_id": str(uuid4()),
        **update,
    }
    response = api_client.post(
        f"/api/manage/orders/{order.pk}/transitions/", body, format="json"
    )
    assert response.status_code == 400 and response.data["code"] == "validation_error"
    assert stock(product) == (5, 2, 3) and order.status_history.count() == 0


def test_api_conflict_envelopes_and_unknown_order(api_client, staff, purchase):
    order, _, _ = purchase
    api_client.force_authenticate(staff)
    url = f"/api/manage/orders/{order.pk}/transitions/"
    key = str(uuid4())
    body = {"expected_status": "pending", "to_status": "paid", "request_id": key}
    assert (
        api_client.post(url, body, format="json").data["code"]
        == "transition_not_allowed"
    )
    body["to_status"] = "cancelled"
    assert api_client.post(url, body, format="json").status_code == 200
    body["comment"] = "Different body"
    response = api_client.post(url, body, format="json")
    assert (
        response.status_code == 409 and response.data["code"] == "idempotency_conflict"
    )
    body["request_id"] = str(uuid4())
    response = api_client.post(url, body, format="json")
    assert (
        response.status_code == 409 and response.data["code"] == "order_status_conflict"
    )
    assert (
        api_client.post(
            f"/api/manage/orders/{uuid4()}/transitions/", body, format="json"
        ).status_code
        == 404
    )


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_key", [True, False])
def test_concurrent_duplicate_cancellation_is_once(purchase, staff, confirm, same_key):
    order, product, payment = purchase
    confirm(payment)
    key = uuid4()
    operations = [
        lambda: apply(
            order, staff, "cancelled", expected_status="paid", request_id=key
        ),
        lambda: apply(
            order,
            staff,
            "cancelled",
            expected_status="paid",
            request_id=key if same_key else uuid4(),
        ),
    ]
    outcomes = race(*operations)
    assert sum(isinstance(value, tuple) for value in outcomes) == (2 if same_key else 1)
    assert sum(isinstance(value, OrderTransitionConflict) for value in outcomes) == (
        0 if same_key else 1
    )
    order.refresh_from_db()
    assert order.status == "cancelled" and order.reservation_state == "restored"
    assert stock(product) == (5, 0, 5) and order.status_history.count() == 2


@pytest.mark.django_db(transaction=True)
def test_concurrent_ship_and_cancel_have_one_consistent_winner(
    purchase, staff, confirm
):
    order, product, payment = purchase
    confirm(payment)
    order.refresh_from_db()
    order, _ = apply(order, staff, "processing")
    outcomes = race(
        lambda: apply(order, staff, "shipped"), lambda: apply(order, staff, "cancelled")
    )
    assert sum(isinstance(value, OrderTransitionConflict) for value in outcomes) == 1
    order.refresh_from_db()
    assert (order.status, order.reservation_state, stock(product)) in [
        ("shipped", "consumed", (3, 0, 3)),
        ("cancelled", "restored", (5, 0, 5)),
    ]
    assert order.status_history.count() == 3


@pytest.mark.django_db(transaction=True)
def test_concurrent_payment_and_staff_cancel_do_not_double_count(
    purchase, staff, confirm
):
    order, product, payment = purchase
    outcomes = race(lambda: confirm(payment), lambda: apply(order, staff, "cancelled"))
    assert all(
        value is None or isinstance(value, (tuple, OrderTransitionConflict))
        for value in outcomes
    )
    order.refresh_from_db()
    payment.refresh_from_db()
    assert payment.status == "succeeded"
    assert (order.status, order.reservation_state, stock(product)) in [
        ("paid", "consumed", (3, 0, 3)),
        ("payment_review", "released", (5, 0, 5)),
    ]
    confirm(payment)
    assert stock(product) in [(3, 0, 3), (5, 0, 5)]


@pytest.mark.django_db(transaction=True)
def test_concurrent_expiry_and_cancel_have_single_release_and_history(purchase, staff):
    order, product, _ = purchase
    deadline = timezone.now() + timedelta(hours=1)
    race(
        lambda: expire_stock_reservations(now=deadline),
        lambda: apply(order, staff, "cancelled"),
    )
    order.refresh_from_db()
    assert order.status == "cancelled" and stock(product) == (5, 0, 5)
    assert order.status_history.count() == 1

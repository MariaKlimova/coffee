"""COFFEE-71 real PostgreSQL behavior. All payments are synthetic mocked truth."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections, connection
from django.test import RequestFactory
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, PermissionDenied

from apps.cart.models import Cart, CartItem
from apps.catalog.models import Product
from apps.orders.buyer_actions import (
    cancel_by_buyer,
    decide_cancellation,
    request_cancellation,
)
from apps.orders.guest_access import recover_guest_checkout
from apps.orders.models import Order, OrderActionIntent
from apps.orders.services import create_order_from_cart, expire_stock_reservations
from apps.orders.workflow import OrderTransitionConflict, transition_order
from apps.payments.models import Payment
from apps.payments.services import handle_webhook

pytestmark = pytest.mark.django_db


@pytest.fixture
def staff():
    return get_user_model().objects.create_user(
        email="staff71@example.test", is_staff=True
    )


@pytest.fixture
def purchase(products, user):
    product = products["cheap"]
    Product.objects.filter(pk=product.pk).update(stock_quantity=7)
    cart = Cart.objects.create(cart_token=uuid4())
    CartItem.objects.create(cart=cart, product=product, quantity=2)
    order = create_order_from_cart(
        cart=cart,
        delivery_address="Synthetic71",
        user=None,
        guest_email="buyer71@example.test",
        guest_phone="+70000000000",
        checkout_request_id=uuid4(),
    )
    token = order._guest_action_token
    payment = Payment.objects.create(
        order=order,
        amount=order.total_amount,
        provider_payment_id=f"synthetic71-{uuid4()}",
    )
    return order, product, payment, token, cart


def inventory(product):
    product.refresh_from_db()
    return product.stock_quantity, product.reserved_quantity


@pytest.fixture
def confirm(monkeypatch, settings):
    settings.YOOKASSA_WEBHOOK_IP_CHECK = False

    def provider(payment_id):
        payment = Payment.objects.get(provider_payment_id=payment_id)
        return {
            "id": payment_id,
            "status": "succeeded",
            "test": True,
            "amount": {"value": str(payment.amount), "currency": "RUB"},
        }

    monkeypatch.setattr("apps.payments.yookassa.get_payment", provider)

    def apply(payment):
        handle_webhook(
            RequestFactory().post("/api/payments/webhook/"),
            {"object": {"id": payment.provider_payment_id}},
        )

    return apply


def cancel(order, token, **kwargs):
    return cancel_by_buyer(
        order_id=order.pk,
        actor=AnonymousUser(),
        token=token,
        expected_status="pending",
        request_id=kwargs.pop("request_id", uuid4()),
        **kwargs,
    )


def request(order, token, **kwargs):
    return request_cancellation(
        order_id=order.pk,
        actor=AnonymousUser(),
        token=token,
        expected_status=kwargs.pop("expected_status", "paid"),
        reason=kwargs.pop("reason", "Передумал"),
        request_id=kwargs.pop("request_id", uuid4()),
        **kwargs,
    )


def decide(order, cancellation, staff, **kwargs):
    return decide_cancellation(
        order_id=order.pk,
        cancellation_id=cancellation.pk,
        actor=staff,
        expected_status=kwargs.pop("expected_status", "paid"),
        decision=kwargs.pop("decision", "accept"),
        public_response=kwargs.pop("public_response", "Запрос рассмотрен"),
        request_id=kwargs.pop("request_id", uuid4()),
        **kwargs,
    )


def transition(order, staff, to_status, **kwargs):
    return transition_order(
        order_id=order.pk,
        actor=staff,
        expected_status=kwargs.pop("expected_status", order.status),
        to_status=to_status,
        request_id=kwargs.pop("request_id", uuid4()),
        **kwargs,
    )


def race(*operations):
    assert connection.vendor == "postgresql"
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
        return [
            future.result(timeout=20)
            for future in [pool.submit(worker, operation) for operation in operations]
        ]


def test_guest_capability_is_issued_once_private_and_recovers_after_cart_deletion(
    api_client, products
):
    cart = Cart.objects.create(cart_token=uuid4())
    original_token = str(cart.cart_token)
    CartItem.objects.create(cart=cart, product=products["cheap"], quantity=2)
    key = str(uuid4())
    body = dict(
        delivery_address="Synthetic guest71",
        guest_email="guest71@example.test",
        guest_phone="+70000000000",
        checkout_request_id=key,
    )
    created = api_client.post(
        "/api/orders/", body, format="json", HTTP_X_CART_TOKEN=original_token
    )
    assert created.status_code == 201, created.data
    order_id, token = created.data["id"], created.data["guest_action_token"]
    assert (
        created.data["guest_action_version"] == 1
        and created["Cache-Control"] == "no-store"
    )
    order = Order.objects.get(pk=order_id)
    assert token != order.guest_action_digest and token not in str(
        list(Order.objects.values())
    )
    public = api_client.get(f"/api/orders/{order_id}/")
    assert (
        "guest_action_token" not in public.data
        and "guest_action_version" not in public.data
    )
    cart.delete()
    replay = api_client.post(
        "/api/orders/", body, format="json", HTTP_X_CART_TOKEN=original_token
    )
    assert (
        replay.status_code == 409
        and replay.data["code"] == "checkout_recovery_required"
    )
    assert Order.objects.count() == 1 and inventory(products["cheap"])[1] == 2
    recovery = api_client.post(
        "/api/orders/checkout-recovery/",
        {"checkout_request_id": key},
        format="json",
        HTTP_X_CART_TOKEN=original_token,
    )
    assert recovery.status_code == 200 and recovery.data["guest_action_version"] == 2
    assert recovery.data["guest_action_token"] != token
    assert (
        api_client.get(
            f"/api/orders/{order_id}/buyer-actions/", HTTP_X_ORDER_ACTION_TOKEN=token
        ).status_code
        == 404
    )
    private = api_client.get(
        f"/api/orders/{order_id}/buyer-actions/",
        HTTP_X_ORDER_ACTION_TOKEN=recovery.data["guest_action_token"],
    )
    assert private.status_code == 200 and private.data["allowed_actions"] == ["cancel"]
    assert {"guest_email", "guest_phone", "stock_review_reason"}.isdisjoint(
        private.data["order"]
    )


def test_recovery_wrong_proof_login_and_changed_checkout_body_are_denied(
    purchase, user, api_client
):
    order, _, _, _, cart = purchase
    for proof in (None, str(uuid4())):
        response = api_client.post(
            "/api/orders/checkout-recovery/",
            {"checkout_request_id": str(order.checkout_request_id)},
            format="json",
            **({"HTTP_X_CART_TOKEN": proof} if proof else {}),
        )
        assert response.status_code == 404
    api_client.force_authenticate(user)
    assert (
        api_client.post(
            "/api/orders/checkout-recovery/",
            {"checkout_request_id": str(order.checkout_request_id)},
            format="json",
            HTTP_X_CART_TOKEN=str(cart.cart_token),
        ).status_code
        == 404
    )
    api_client.force_authenticate(None)
    response = api_client.post(
        "/api/orders/",
        dict(
            delivery_address="Changed",
            guest_email="buyer71@example.test",
            guest_phone="+70000000000",
            checkout_request_id=str(order.checkout_request_id),
        ),
        format="json",
        HTTP_X_CART_TOKEN=str(cart.cart_token),
    )
    assert (
        response.status_code == 409 and response.data["code"] == "idempotency_conflict"
    )


@pytest.mark.parametrize("kind", ["none", "wrong", "logged_in", "legacy"])
def test_public_uuid_contacts_login_or_old_guest_never_grant_actions(
    purchase, user, api_client, kind
):
    order, product, _, token, _ = purchase
    if kind == "legacy":
        Order.objects.filter(pk=order.pk).update(guest_action_digest="")
    if kind == "logged_in":
        api_client.force_authenticate(user)
    headers = (
        {}
        if kind == "none"
        else {"HTTP_X_ORDER_ACTION_TOKEN": "wrong" if kind == "wrong" else token}
    )
    for method, suffix, body in [
        ("get", "buyer-actions", None),
        ("post", "cancel", dict(request_id=str(uuid4()), expected_status="pending")),
    ]:
        response = getattr(api_client, method)(
            f"/api/orders/{order.pk}/{suffix}/", body, format="json", **headers
        )
        assert response.status_code == 404
    assert inventory(product) == (7, 2)


def test_owner_persisted_rights_and_staff_guard(purchase, user, staff):
    order, product, _, _, _ = purchase
    order.user = user
    order.save(update_fields=["user"])
    with pytest.raises(NotFound):
        cancel_by_buyer(
            order_id=order.pk,
            actor=staff,
            expected_status="pending",
            request_id=uuid4(),
        )
    with pytest.raises(PermissionDenied):
        transition(order, user, "cancelled")
    get_user_model().objects.filter(pk=user.pk).update(is_active=False)
    with pytest.raises(NotFound):
        cancel_by_buyer(
            order_id=order.pk, actor=user, expected_status="pending", request_id=uuid4()
        )
    get_user_model().objects.filter(pk=user.pk).update(is_active=True)
    cancel_by_buyer(
        order_id=order.pk, actor=user, expected_status="pending", request_id=uuid4()
    )
    assert inventory(product) == (7, 0)
    event = order.status_history.get()
    assert (
        event.source == "buyer"
        and event.actor_id == user.pk
        and "Сотрудник" not in event.actor_label
    )


def test_pending_cancel_replay_late_payment_and_rotation_have_stable_intent(
    purchase, confirm
):
    order, product, payment, token, cart = purchase
    key = uuid4()
    cancel(order, token, request_id=key, reason=" Передумал ")
    assert inventory(product) == (7, 0)
    recovered, rotated = recover_guest_checkout(
        checkout_request_id=order.checkout_request_id,
        original_cart_token=str(cart.cart_token),
        actor=AnonymousUser(),
    )
    assert recovered.guest_action_version == 2
    confirm(payment)
    current, replayed = cancel(order, rotated, request_id=key, reason="Передумал")
    assert replayed and current.status == "payment_review"
    assert inventory(product) == (7, 0) and order.status_history.count() == 2
    assert list(order.status_history.values_list("source", flat=True)) == [
        "buyer",
        "payment",
    ]
    with pytest.raises(NotFound):
        cancel(order, token, request_id=key)
    with pytest.raises(OrderTransitionConflict):
        cancel(order, rotated, request_id=key, reason="Changed")


def test_request_only_then_decline_preserves_money_inventory_and_privacy(
    purchase, confirm, staff, api_client
):
    order, product, payment, token, _ = purchase
    confirm(payment)
    before = list(Payment.objects.values())
    key = uuid4()
    request(order, token, request_id=key)
    assert request(order, token, request_id=key)[1]
    with pytest.raises(OrderTransitionConflict):
        request(order, token)
    cancellation = order.cancellation_requests.get()
    assert inventory(product) == (5, 0)
    order.refresh_from_db()
    assert order.status == "paid" and order.status_history.count() == 1
    decision_key = uuid4()
    decide(
        order,
        cancellation,
        staff,
        decision="decline",
        request_id=decision_key,
        public_response="Уточни пожелания в магазине",
        private_comment="Private staff71",
    )
    assert decide(
        order,
        cancellation,
        staff,
        decision="decline",
        request_id=decision_key,
        public_response="Уточни пожелания в магазине",
        private_comment="Private staff71",
    )[1]
    private = api_client.get(
        f"/api/orders/{order.pk}/buyer-actions/", HTTP_X_ORDER_ACTION_TOKEN=token
    )
    result = private.data["cancellation_requests"][0]
    assert (
        result["state"] == "declined"
        and result["public_response"] == "Уточни пожелания в магазине"
    )
    assert (
        "private_comment" not in str(private.data)
        and "Private staff71" not in str(private.data)
        and "decided_by" not in str(private.data)
    )
    assert list(Payment.objects.values()) == before and inventory(product) == (5, 0)
    request(order, token)
    assert order.cancellation_requests.count() == 2


@pytest.mark.parametrize("legacy", [False, True])
def test_staff_accept_restores_once_and_keeps_private_comment_separate(
    purchase, confirm, staff, legacy
):
    order, product, payment, token, _ = purchase
    confirm(payment)
    if legacy:
        Order.objects.filter(pk=order.pk).update(reservation_state="none")
    request(order, token)
    cancellation = order.cancellation_requests.get()
    key = uuid4()
    decide(
        order,
        cancellation,
        staff,
        request_id=key,
        public_response="Отмена принята",
        private_comment="Internal71",
    )
    assert decide(
        order,
        cancellation,
        staff,
        request_id=key,
        public_response="Отмена принята",
        private_comment="Internal71",
    )[1]
    order.refresh_from_db()
    cancellation.refresh_from_db()
    payment.refresh_from_db()
    assert (
        cancellation.state == "accepted"
        and cancellation.public_response == "Отмена принята"
    )
    assert cancellation.private_comment == "Internal71" and order.status == "cancelled"
    assert order.reservation_state == ("none" if legacy else "restored")
    assert (
        inventory(product) == ((5, 0) if legacy else (7, 0))
        and payment.status == "succeeded"
    )


@pytest.mark.parametrize("target", ["shipped", "cancelled"])
def test_ordinary_staff_transition_closes_request_without_leaking_comment(
    purchase, confirm, staff, target
):
    order, _, payment, token, _ = purchase
    confirm(payment)
    order.refresh_from_db()
    transition(order, staff, "processing")
    request(order, token, expected_status="processing")
    transition(
        order, staff, target, expected_status="processing", comment="Internal only"
    )
    cancellation = order.cancellation_requests.get()
    assert cancellation.state == (
        "accepted" if target == "cancelled" else "closed_unavailable"
    )
    assert "Internal only" not in cancellation.public_response
    with pytest.raises(OrderTransitionConflict):
        decide(order, cancellation, staff, expected_status="processing")


def test_intent_namespace_blocks_cross_actor_and_all_entrypoints(
    purchase, confirm, staff
):
    order, _, payment, token, _ = purchase
    confirm(payment)
    key = uuid4()
    request(order, token, request_id=key)
    with pytest.raises(OrderTransitionConflict) as failure:
        transition(order, staff, "processing", expected_status="paid", request_id=key)
    assert failure.value.detail.code == "idempotency_conflict"
    other_key = uuid4()
    transition(order, staff, "processing", expected_status="paid", request_id=other_key)
    with pytest.raises(OrderTransitionConflict) as failure:
        request(order, token, expected_status="processing", request_id=other_key)
    assert failure.value.detail.code == "idempotency_conflict"
    with pytest.raises(OrderTransitionConflict):
        decide(
            order,
            order.cancellation_requests.get(),
            staff,
            request_id=key,
            expected_status="processing",
        )


def test_failure_rolls_back_request_decision_stock_history_and_intent(
    purchase, confirm, staff, monkeypatch
):
    order, product, payment, token, _ = purchase
    confirm(payment)
    request(order, token)
    cancellation = order.cancellation_requests.get()

    def fail(*args, **kwargs):
        raise RuntimeError("Synthetic audit failure")

    monkeypatch.setattr("apps.orders.workflow.record_status_transition", fail)
    with pytest.raises(RuntimeError):
        decide(order, cancellation, staff)
    order.refresh_from_db()
    cancellation.refresh_from_db()
    assert (
        order.status == "paid"
        and cancellation.state == "open"
        and inventory(product) == (5, 0)
    )
    assert order.status_history.count() == 1 and OrderActionIntent.objects.count() == 1


def test_private_get_and_request_do_not_trigger_expiry_business_writes(
    purchase, api_client
):
    order, product, _, token, _ = purchase
    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timedelta(minutes=1)
    )
    response = api_client.get(
        f"/api/orders/{order.pk}/buyer-actions/", HTTP_X_ORDER_ACTION_TOKEN=token
    )
    assert response.status_code == 200
    order.refresh_from_db()
    assert (
        order.status == "pending"
        and inventory(product) == (7, 2)
        and order.status_history.count() == 0
    )


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_key", [True, False])
def test_concurrent_cancel_intents_release_once(purchase, same_key):
    order, product, _, token, _ = purchase
    key = uuid4()
    results = race(
        lambda: cancel(order, token, request_id=key),
        lambda: cancel(order, token, request_id=key if same_key else uuid4()),
    )
    assert sum(isinstance(result, tuple) for result in results) == (
        2 if same_key else 1
    )
    assert inventory(product) == (7, 0) and order.status_history.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_cancel_and_confirmed_payment_keep_real_money(purchase, confirm):
    order, product, payment, token, _ = purchase
    race(lambda: cancel(order, token), lambda: confirm(payment))
    order.refresh_from_db()
    payment.refresh_from_db()
    assert payment.status == "succeeded"
    assert (order.status, order.reservation_state, inventory(product)) in [
        ("paid", "consumed", (5, 0)),
        ("payment_review", "released", (7, 0)),
    ]


@pytest.mark.django_db(transaction=True)
def test_concurrent_cancel_expiry_have_one_event(purchase):
    order, product, _, token, _ = purchase
    race(
        lambda: cancel(order, token),
        lambda: expire_stock_reservations(now=timezone.now() + timedelta(hours=1)),
    )
    order.refresh_from_db()
    assert (
        order.status == "cancelled"
        and inventory(product) == (7, 0)
        and order.status_history.count() == 1
    )


@pytest.mark.django_db(transaction=True)
def test_concurrent_requests_one_open_and_no_other_effect(purchase, confirm):
    order, product, payment, token, _ = purchase
    confirm(payment)
    results = race(lambda: request(order, token), lambda: request(order, token))
    assert sum(isinstance(result, tuple) for result in results) == 1
    assert order.cancellation_requests.filter(state="open").count() == 1
    assert inventory(product) == (5, 0) and order.status_history.count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("opponent", ["ship", "decline"])
def test_concurrent_accept_vs_ship_or_decline_has_consistent_winner(
    purchase, confirm, staff, opponent
):
    order, product, payment, token, _ = purchase
    confirm(payment)
    order.refresh_from_db()
    transition(order, staff, "processing")
    request(order, token, expected_status="processing")
    cancellation = order.cancellation_requests.get()
    results = race(
        lambda: decide(order, cancellation, staff, expected_status="processing"),
        lambda: (
            transition(order, staff, "shipped", expected_status="processing")
            if opponent == "ship"
            else decide(
                order,
                cancellation,
                staff,
                expected_status="processing",
                decision="decline",
            )
        ),
    )
    assert sum(isinstance(result, OrderTransitionConflict) for result in results) == 1
    order.refresh_from_db()
    cancellation.refresh_from_db()
    assert (order.status, cancellation.state, inventory(product)) in [
        ("cancelled", "accepted", (7, 0)),
        ("shipped", "closed_unavailable", (5, 0)),
        ("processing", "declined", (5, 0)),
    ]


def test_new_action_endpoints_and_safe_schema_are_documented():
    from pathlib import Path

    import yaml
    from drf_spectacular.generators import SchemaGenerator

    contract = yaml.safe_load(
        (Path(__file__).resolve().parents[2] / "docs/api/openapi.yaml").read_text()
    )
    generated = SchemaGenerator().get_schema(request=None, public=True)
    paths = {
        "/api/orders/checkout-recovery/": "post",
        "/api/orders/{id}/buyer-actions/": "get",
        "/api/orders/{id}/cancel/": "post",
        "/api/orders/{id}/cancellation-requests/": "post",
        (
            "/api/manage/orders/{id}/cancellation-requests/"
            "{cancellation_id}/decision/"
        ): "post",
    }
    for path, method in paths.items():
        assert set(contract["paths"][path]) == {method}
        assert set(generated["paths"][path]) == {method}
    schemas = generated["components"]["schemas"]
    assert set(schemas["BuyerOrder"]["properties"]) == set(
        contract["components"]["schemas"]["BuyerOrder"]["properties"]
    )
    assert set(schemas["PublicCancellationRequest"]["properties"]) == {
        "id",
        "reason",
        "state",
        "created_at",
        "decided_at",
        "public_response",
    }
    for name in (
        "BuyerCancelRequest",
        "BuyerCancellationRequest",
        "CancellationDecision",
        "GuestCheckoutRecovery",
    ):
        assert schemas[name]["additionalProperties"] is False
        assert set(schemas[name]["properties"]) == set(
            contract["components"]["schemas"][name]["properties"]
        )
    assert (
        schemas["GuestCheckoutRecoveryResponse"]["properties"]["guest_action_version"][
            "type"
        ]
        == "integer"
    )


def test_manage_decision_api_accept_replay_and_public_result(
    purchase, confirm, staff, api_client
):
    order, product, payment, token, _ = purchase
    confirm(payment)
    response = api_client.post(
        f"/api/orders/{order.pk}/cancellation-requests/",
        {"request_id": str(uuid4()), "expected_status": "paid", "reason": "Передумал"},
        format="json",
        HTTP_X_ORDER_ACTION_TOKEN=token,
    )
    assert response.status_code == 200, response.data
    cancellation = order.cancellation_requests.get()
    api_client.force_authenticate(staff)
    listed = api_client.get("/api/manage/orders/")
    assert listed.data["results"][0]["open_cancellation_request"]["id"] == str(
        cancellation.pk
    )
    url = (
        f"/api/manage/orders/{order.pk}/cancellation-requests/"
        f"{cancellation.pk}/decision/"
    )
    body = dict(
        request_id=str(uuid4()),
        expected_status="paid",
        decision="accept",
        public_response="Отмена принята",
        private_comment="Private decision71",
    )
    accepted = api_client.post(url, body, format="json")
    assert accepted.status_code == 200, accepted.data
    assert accepted.data["order"]["cancellation_requests"][0]["decided_by"][
        "id"
    ] == str(staff.pk)
    assert accepted.data["order"]["open_cancellation_request"] is None
    assert api_client.post(url, body, format="json").data["replayed"]
    api_client.force_authenticate(None)
    public = api_client.get(
        f"/api/orders/{order.pk}/buyer-actions/", HTTP_X_ORDER_ACTION_TOKEN=token
    )
    assert public.data["order"]["status"] == "cancelled"
    assert (
        public.data["cancellation_requests"][0]["public_response"] == "Отмена принята"
    )
    assert "Private decision71" not in str(public.data) and inventory(product) == (7, 0)


@pytest.mark.django_db(transaction=True)
def test_recovery_versions_increase_atomically_and_one_latest_token_works(purchase):
    order, _, _, _, cart = purchase

    def recover():
        return recover_guest_checkout(
            checkout_request_id=order.checkout_request_id,
            original_cart_token=cart.cart_token,
            actor=AnonymousUser(),
        )

    results = race(recover, recover)
    assert sorted(current.guest_action_version for current, _ in results) == [2, 3]
    order.refresh_from_db()
    from apps.orders.buyer_actions import authorize_buyer

    for current, token in results:
        if current.guest_action_version == 3:
            assert (
                authorize_buyer(order, actor=AnonymousUser(), token=token)
                == f"guest:{order.pk}"
            )
        else:
            with pytest.raises(NotFound):
                authorize_buyer(order, actor=AnonymousUser(), token=token)


@pytest.mark.django_db(transaction=True)
def test_guest_checkout_duplicate_intent_has_one_snapshot(purchase, products):
    # Fresh Cart with known original token; two serialized checkouts consume it once.
    cart = Cart.objects.create(cart_token=uuid4())
    CartItem.objects.create(cart=cart, product=products["pricey"], quantity=1)
    key = uuid4()

    def create():
        return create_order_from_cart(
            cart=cart,
            user=None,
            delivery_address="Synthetic duplicate71",
            guest_email="guest71@example.test",
            guest_phone="+70000000000",
            checkout_request_id=key,
        )

    results = race(create, create)
    assert sum(isinstance(result, Order) for result in results) == 1
    assert sum(isinstance(result, OrderTransitionConflict) for result in results) == 1
    assert Order.objects.filter(checkout_request_id=key).count() == 1
    assert inventory(products["pricey"])[1] == 1


def test_create_never_pairs_old_token_with_new_version_during_other_tab_recovery(
    api_client, products, monkeypatch
):
    cart = Cart.objects.create(cart_token=uuid4())
    CartItem.objects.create(cart=cart, product=products["cheap"], quantity=1)
    key = uuid4()
    recovered = {}

    def create_then_other_tab_recovers(**kwargs):
        original = create_order_from_cart(**kwargs)
        current, token = recover_guest_checkout(
            checkout_request_id=key,
            original_cart_token=cart.cart_token,
            actor=AnonymousUser(),
        )
        recovered.update(token=token, version=current.guest_action_version)
        return original

    monkeypatch.setattr(
        "apps.orders.views.create_order_from_cart", create_then_other_tab_recovers
    )
    response = api_client.post(
        "/api/orders/",
        dict(
            delivery_address="Synthetic issuance race71",
            guest_email="guest71@example.test",
            guest_phone="+70000000000",
            checkout_request_id=str(key),
        ),
        format="json",
        HTTP_X_CART_TOKEN=str(cart.cart_token),
    )
    assert response.status_code == 201
    assert response.data["guest_action_version"] == 1 and recovered["version"] == 2
    assert response.data["guest_action_token"] != recovered["token"]


@pytest.mark.django_db(transaction=True)
def test_different_cart_intent_collision_is_uniform_not_found_and_no_double_reserve(
    products,
):
    carts = [Cart.objects.create(cart_token=uuid4()) for _ in range(2)]
    for cart, product in zip(
        carts, [products["cheap"], products["pricey"]], strict=True
    ):
        CartItem.objects.create(cart=cart, product=product, quantity=1)
    key = uuid4()

    def create(cart):
        return create_order_from_cart(
            cart=cart,
            user=None,
            delivery_address="Synthetic conflicting carts71",
            guest_email="guest71@example.test",
            guest_phone="+70000000000",
            checkout_request_id=key,
        )

    results = race(lambda: create(carts[0]), lambda: create(carts[1]))
    assert sum(isinstance(result, Order) for result in results) == 1
    assert sum(isinstance(result, NotFound) for result in results) == 1
    assert Order.objects.filter(checkout_request_id=key).count() == 1
    assert (
        sum(
            inventory(product)[1] for product in [products["cheap"], products["pricey"]]
        )
        == 1
    )


def test_request_and_decisions_never_call_provider(
    purchase, confirm, staff, monkeypatch
):
    order, _, payment, token, _ = purchase
    confirm(payment)

    def forbidden(*args, **kwargs):
        raise AssertionError("Cancellation must not call a provider")

    monkeypatch.setattr("apps.payments.yookassa.get_payment", forbidden)
    monkeypatch.setattr("apps.payments.yookassa.create_payment", forbidden)
    request(order, token)
    decide(order, order.cancellation_requests.get(), staff, decision="decline")
    request(order, token)
    decide(order, order.cancellation_requests.get(state="open"), staff)


def test_buyer_cancel_preserves_other_reservation_and_history(purchase, products):
    order, product, _, token, _ = purchase
    cart = Cart.objects.create(cart_token=uuid4())
    CartItem.objects.create(cart=cart, product=product, quantity=1)
    sibling = create_order_from_cart(
        cart=cart, user=None, delivery_address="Synthetic sibling71"
    )
    assert inventory(product) == (7, 3)
    cancel(order, token)
    sibling.refresh_from_db()
    assert (
        inventory(product) == (7, 1)
        and sibling.reservation_state == "active"
        and sibling.status == "pending"
    )


def test_shipment_request_closure_rolls_back_with_failed_audit(
    purchase, confirm, staff, monkeypatch
):
    order, product, payment, token, _ = purchase
    confirm(payment)
    order.refresh_from_db()
    transition(order, staff, "processing")
    request(order, token, expected_status="processing")

    def fail(*args, **kwargs):
        raise RuntimeError("Synthetic audit failure")

    monkeypatch.setattr(
        "apps.orders.history.OrderStatusTransition.objects.create", fail
    )
    with pytest.raises(RuntimeError):
        transition(order, staff, "shipped", expected_status="processing")
    order.refresh_from_db()
    assert (
        order.status == "processing"
        and order.cancellation_requests.get().state == "open"
        and inventory(product) == (5, 0)
    )


def test_effective_buyer_and_staff_security_preserves_guest_proof_boundary():
    from pathlib import Path

    import yaml
    from drf_spectacular.generators import SchemaGenerator

    contract = yaml.safe_load(
        (Path(__file__).resolve().parents[2] / "docs/api/openapi.yaml").read_text()
    )
    generated = SchemaGenerator().get_schema(request=None, public=True)
    buyer_paths = {
        "/api/orders/{id}/buyer-actions/": "get",
        "/api/orders/{id}/cancel/": "post",
        "/api/orders/{id}/cancellation-requests/": "post",
    }
    staff_paths = [
        "/api/manage/orders/{id}/transitions/",
        (
            "/api/manage/orders/{id}/cancellation-requests/"
            "{cancellation_id}/decision/"
        ),
    ]
    for schema, jwt in [(contract, "bearerAuth"), (generated, "jwtAuth")]:
        for path, method in buyer_paths.items():
            operation = schema["paths"][path][method]
            effective = operation.get("security", schema.get("security", []))
            assert effective == [{jwt: []}, {}]
            assert "X-Order-Action-Token" in operation["description"]
            assert "proof-free" in operation["description"]
        for path in staff_paths:
            operation = schema["paths"][path]["post"]
            assert operation.get("security", schema.get("security", [])) == [{jwt: []}]
        recovery = schema["paths"]["/api/orders/checkout-recovery/"]["post"]
        assert recovery.get("security", schema.get("security", [])) == []
        assert "Anonymous" in recovery["description"]


@pytest.mark.parametrize("actor", ["guest", "staff"])
def test_shared_strict_input_rejects_unknown_fields_before_mutation(
    purchase, staff, api_client, actor
):
    order, product, _, token, _ = purchase
    body = dict(request_id=str(uuid4()), expected_status="pending", status="cancelled")
    if actor == "staff":
        api_client.force_authenticate(staff)
        body["to_status"] = "cancelled"
        url = f"/api/manage/orders/{order.pk}/transitions/"
        headers = {}
    else:
        url = f"/api/orders/{order.pk}/cancel/"
        headers = {"HTTP_X_ORDER_ACTION_TOKEN": token}
    response = api_client.post(url, body, format="json", **headers)
    assert response.status_code == 400
    assert response.data["errors"]["status"] == ["Unknown field."]
    order.refresh_from_db()
    assert order.status == "pending" and inventory(product) == (7, 2)
    assert order.status_history.count() == 0 and order.action_intents.count() == 0

"""COFFEE-62: PostgreSQL inventory, lifecycle and transactional race coverage."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from django.contrib.auth.models import AnonymousUser
from django.core.management import call_command
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.test import RequestFactory
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.cart.models import Cart, CartItem
from apps.cart.services import add_item, merge_guest_cart, update_item_quantity
from apps.catalog.models import Product, StockAdjustment
from apps.catalog.services import InsufficientStock, adjust_stock
from apps.orders.models import Order, StockReservationLine
from apps.orders.services import (
    cancel_unpaid_order,
    create_order_from_cart,
    expire_stock_reservations,
)
from apps.payments.models import Payment
from apps.payments.services import handle_webhook

pytestmark = pytest.mark.django_db


@pytest.fixture
def stock(products):
    product = products["cheap"]
    Product.objects.filter(pk=product.pk).update(stock_quantity=3)
    product.refresh_from_db()
    return product


def cart_with(product, quantity=1):
    cart = Cart.objects.create(cart_token=uuid4())
    CartItem.objects.create(cart=cart, product=product, quantity=quantity)
    return cart


def checkout(cart):
    return create_order_from_cart(
        cart=cart,
        delivery_address="Synthetic address",
        user=None,
        guest_email="inventory@example.test",
        guest_phone="+70000000000",
    )


def pending_payment(order):
    return Payment.objects.create(
        order=order,
        provider_payment_id=f"inventory-{uuid4()}",
        amount=order.total_amount,
        confirmation_url="https://example.test/payment",
    )


def verified_success(monkeypatch, settings):
    settings.YOOKASSA_WEBHOOK_IP_CHECK = False

    def provider(provider_id):
        payment = Payment.objects.get(provider_payment_id=provider_id)
        return {
            "id": provider_id,
            "status": "succeeded",
            "paid": True,
            "amount": {"value": str(payment.amount), "currency": "RUB"},
            "test": True,
        }

    monkeypatch.setattr("apps.payments.yookassa.get_payment", provider)


def succeed(payment):
    handle_webhook(
        RequestFactory().post("/api/payments/webhook/"),
        {"object": {"id": payment.provider_payment_id}},
    )


def inventory(product):
    product.refresh_from_db()
    return product.stock_quantity, product.reserved_quantity, product.available_quantity


def race(*operations):
    """Real independent DB connections, synchronized before taking domain locks."""
    assert (
        connection.vendor == "postgresql"
    ), "Concurrency acceptance requires PostgreSQL"
    barrier = Barrier(len(operations), timeout=10)

    def execute(operation):
        close_old_connections()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SET lock_timeout = '8s'")
            barrier.wait()
            try:
                return operation()
            except (InsufficientStock, ValidationError) as exc:
                return exc
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=len(operations)) as pool:
        futures = [pool.submit(execute, operation) for operation in operations]
        return [future.result(timeout=20) for future in futures]


def test_cart_add_patch_limits_and_numeric_error(api_client, stock):
    response = api_client.post(
        reverse("cart-item-create"), {"product_id": str(stock.pk), "quantity": 4}
    )
    assert response.status_code == 400
    assert response.json()["code"] == "insufficient_stock"
    assert response.json()["available_quantity"] == 3
    assert response.json()["requested_quantity"] == 4
    assert CartItem.objects.count() == 0
    cart = cart_with(stock, 2)
    with pytest.raises(InsufficientStock):
        add_item(cart=cart, product_id=stock.pk, quantity=2)
    item = cart.items.get()
    with pytest.raises(InsufficientStock):
        update_item_quantity(cart=cart, item_id=item.pk, quantity=4)
    item.refresh_from_db()
    assert item.quantity == 2
    assert inventory(stock) == (3, 0, 3)


def test_zero_stock_and_unpublished_block_direct_checkout(stock):
    Product.objects.filter(pk=stock.pk).update(stock_quantity=0)
    cart = cart_with(stock)
    with pytest.raises(InsufficientStock):
        checkout(cart)
    Product.objects.filter(pk=stock.pk).update(stock_quantity=3, is_published=False)
    with pytest.raises(InsufficientStock):
        add_item(cart=cart, product_id=stock.pk, quantity=1)
    with pytest.raises(InsufficientStock):
        checkout(cart)
    assert not Order.objects.exists()
    assert inventory(stock) == (3, 0, 3)


def test_merge_rejects_entire_overflow_without_consuming_guest(stock, user, products):
    user_cart = Cart.objects.create(user=user)
    CartItem.objects.create(cart=user_cart, product=stock, quantity=2)
    guest = cart_with(stock, 2)
    CartItem.objects.create(cart=guest, product=products["pricey"], quantity=1)
    with pytest.raises(InsufficientStock):
        merge_guest_cart(user=user, cart_token=guest.cart_token)
    assert guest.items.count() == 2
    assert user_cart.items.count() == 1
    assert user_cart.items.get().quantity == 2


def test_merge_exact_available_and_zero_reject(stock, user):
    user_cart = Cart.objects.create(user=user)
    CartItem.objects.create(cart=user_cart, product=stock, quantity=1)
    guest = cart_with(stock, 2)
    merge_guest_cart(user=user, cart_token=guest.cart_token)
    assert user_cart.items.get().quantity == 3
    assert not Cart.objects.filter(pk=guest.pk).exists()
    guest = cart_with(stock)
    Product.objects.filter(pk=stock.pk).update(stock_quantity=0)
    with pytest.raises(InsufficientStock):
        merge_guest_cart(user=user, cart_token=guest.cart_token)
    assert Cart.objects.filter(pk=guest.pk).exists()


def test_checkout_reserves_before_any_payment_then_consumes_once(
    stock, monkeypatch, settings
):
    order = checkout(cart_with(stock, 2))
    assert inventory(stock) == (3, 2, 1)
    assert order.reservation_state == Order.ReservationState.ACTIVE
    assert order.stock_lines.get().quantity == 2
    assert not Payment.objects.exists()
    payment = pending_payment(order)
    verified_success(monkeypatch, settings)
    succeed(payment)
    succeed(payment)
    assert inventory(stock) == (1, 0, 1)
    order.refresh_from_db()
    assert order.status == Order.Status.PAID
    assert order.reservation_state == Order.ReservationState.CONSUMED
    second = pending_payment(order)
    succeed(second)
    assert inventory(stock) == (1, 0, 1)
    assert Payment.objects.filter(order=order, status="succeeded").count() == 1


def test_any_line_shortage_rolls_back_all_lines(stock, products):
    cart = cart_with(stock, 2)
    CartItem.objects.create(cart=cart, product=products["unavailable"], quantity=1)
    with pytest.raises(InsufficientStock):
        checkout(cart)
    assert inventory(stock) == (3, 0, 3)
    assert cart.items.count() == 2
    assert not Order.objects.exists()
    assert not StockReservationLine.objects.exists()


def test_cancel_and_expiry_release_only_once(stock):
    order = checkout(cart_with(stock, 2))
    cancel_unpaid_order(order_id=order.pk)
    cancel_unpaid_order(order_id=order.pk)
    assert inventory(stock) == (3, 0, 3)
    assert expire_stock_reservations(now=timezone.now() + timedelta(days=1)) == 0
    assert inventory(stock) == (3, 0, 3)


def test_ttl_is_configurable_and_ingress_really_runs_cleanup(
    stock, settings, api_client
):
    settings.STOCK_RESERVATION_TTL_SECONDS = 17
    before = timezone.now()
    order = checkout(cart_with(stock, 2))
    assert (
        before + timedelta(seconds=17)
        <= order.reservation_expires_at
        <= timezone.now() + timedelta(seconds=17)
    )
    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timedelta(seconds=1)
    )
    response = api_client.get(reverse("product-list"))
    assert response.status_code == 200
    assert inventory(stock) == (3, 0, 3)
    order.refresh_from_db()
    assert order.status == Order.Status.CANCELLED
    call_command("expire_stock_reservations")
    assert inventory(stock) == (3, 0, 3)


def test_command_expires_multiple_orders_idempotently(stock):
    first = checkout(cart_with(stock))
    second = checkout(cart_with(stock))
    Order.objects.filter(pk__in=[first.pk, second.pk]).update(
        reservation_expires_at=timezone.now() - timedelta(seconds=1)
    )
    call_command("expire_stock_reservations")
    call_command("expire_stock_reservations")
    assert inventory(stock) == (3, 0, 3)
    assert (
        Order.objects.filter(reservation_state="released", status="cancelled").count()
        == 2
    )


def test_late_success_is_visible_and_does_not_steal_new_reservation(
    stock, monkeypatch, settings, api_client
):
    original = checkout(cart_with(stock, 3))
    payment = pending_payment(original)
    expire_stock_reservations(now=original.reservation_expires_at)
    replacement = checkout(cart_with(stock, 3))
    verified_success(monkeypatch, settings)
    succeed(payment)
    succeed(payment)
    original.refresh_from_db()
    payment.refresh_from_db()
    assert original.status == Order.Status.PAYMENT_REVIEW
    assert original.stock_review_reason == "payment_after_reservation_release"
    assert payment.status == Payment.Status.SUCCEEDED
    assert inventory(stock) == (3, 3, 0)
    replacement.refresh_from_db()
    assert replacement.reservation_state == Order.ReservationState.ACTIVE
    body = api_client.get(reverse("order-detail", kwargs={"id": original.pk})).json()
    assert body["status"] == "payment_review"
    assert body["reservation_state"] == "released"
    assert body["stock_review_reason"] == "payment_after_reservation_release"


def test_success_after_deadline_without_cleanup_still_reviews(
    stock, monkeypatch, settings
):
    order = checkout(cart_with(stock, 2))
    payment = pending_payment(order)
    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timedelta(seconds=1)
    )
    verified_success(monkeypatch, settings)
    succeed(payment)
    order.refresh_from_db()
    assert order.status == Order.Status.PAYMENT_REVIEW
    assert inventory(stock) == (3, 0, 3)


def test_legacy_pending_cannot_start_payment_but_existing_success_is_preserved(
    api_client, stock, settings, monkeypatch
):
    legacy = Order.objects.create(
        guest_email="legacy@example.test",
        delivery_address="Synthetic",
        total_amount=stock.price,
    )
    provider_create = []
    monkeypatch.setattr(
        "apps.payments.yookassa.create_payment", lambda **kw: provider_create.append(kw)
    )
    response = api_client.post(reverse("payment-create"), {"order_id": str(legacy.pk)})
    assert response.status_code == 400
    assert provider_create == []
    payment = pending_payment(legacy)
    verified_success(monkeypatch, settings)
    succeed(payment)
    legacy.refresh_from_db()
    payment.refresh_from_db()
    assert legacy.status == Order.Status.PAYMENT_REVIEW
    assert legacy.stock_review_reason == "legacy_order_without_counted_stock"
    assert payment.status == Payment.Status.SUCCEEDED
    assert inventory(stock) == (3, 0, 3)


def test_paid_cancel_does_not_release_or_refund(stock, monkeypatch, settings):
    order = checkout(cart_with(stock, 2))
    payment = pending_payment(order)
    verified_success(monkeypatch, settings)
    succeed(payment)
    with pytest.raises(ValidationError):
        cancel_unpaid_order(order_id=order.pk)
    assert inventory(stock) == (1, 0, 1)
    payment.refresh_from_db()
    assert payment.status == Payment.Status.SUCCEEDED


def test_staff_adjustment_auth_reservation_floor_and_audit(stock, user):
    checkout(cart_with(stock, 2))
    for actor in [None, AnonymousUser(), user]:
        with pytest.raises(PermissionDenied):
            adjust_stock(
                product_id=stock.pk, quantity=10, actor=actor, reason="Inventory count"
            )
    user.is_staff = True
    # A caller cannot forge a staff flag on an object without persisted rights.
    with pytest.raises(PermissionDenied):
        adjust_stock(
            product_id=stock.pk, quantity=10, actor=user, reason="Inventory count"
        )
    user.save(update_fields=["is_staff"])
    with pytest.raises(ValidationError):
        adjust_stock(
            product_id=stock.pk, quantity=1, actor=user, reason="Inventory count"
        )
    result = adjust_stock(
        product_id=stock.pk, quantity=5, actor=user, reason="Inventory count"
    )
    assert (
        result.stock_quantity,
        result.reserved_quantity,
        result.available_quantity,
    ) == (5, 2, 3)
    audit = StockAdjustment.objects.get()
    assert (
        audit.actor_id,
        audit.product_id,
        audit.before_quantity,
        audit.after_quantity,
    ) == (user.pk, stock.pk, 3, 5)
    assert audit.created_at and audit.reason == "Inventory count"


@pytest.mark.parametrize("quantity", [-1, True, 1.5, "2", 2147483648])
def test_staff_adjustment_rejects_invalid_counts(stock, user, quantity):
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    with pytest.raises(ValidationError):
        adjust_stock(product_id=stock.pk, quantity=quantity, actor=user, reason="Count")
    assert not StockAdjustment.objects.exists()


def test_database_constraints_and_stale_catalog_save_preserve_counters(stock):
    stale = Product.objects.get(pk=stock.pk)
    checkout(cart_with(stock, 2))
    stale.name = "Edited while checkout reserved"
    stale.save()
    assert inventory(stock) == (3, 2, 1)
    for data in [
        {"stock_quantity": 1},
        {"stock_quantity": -1},
        {"reserved_quantity": -1},
        {"reserved_quantity": 4},
    ]:
        with pytest.raises(IntegrityError), transaction.atomic():
            Product.objects.filter(pk=stock.pk).update(**data)
    assert inventory(stock) == (3, 2, 1)


@pytest.mark.django_db(transaction=True)
def test_concurrent_last_unit_checkout_has_exactly_one_winner(stock):
    Product.objects.filter(pk=stock.pk).update(stock_quantity=1)
    first, second = cart_with(stock), cart_with(stock)
    outcomes = race(lambda: checkout(first), lambda: checkout(second))
    assert sum(isinstance(outcome, Order) for outcome in outcomes) == 1
    assert sum(isinstance(outcome, InsufficientStock) for outcome in outcomes) == 1
    assert inventory(stock) == (1, 1, 0)
    assert Order.objects.count() == 1
    assert CartItem.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_payment_and_cancel_converge_without_negative_stock(
    stock, monkeypatch, settings
):
    order = checkout(cart_with(stock, 2))
    payment = pending_payment(order)
    verified_success(monkeypatch, settings)
    race(lambda: succeed(payment), lambda: cancel_unpaid_order(order_id=order.pk))
    order.refresh_from_db()
    payment.refresh_from_db()
    assert payment.status == Payment.Status.SUCCEEDED
    assert order.status in [Order.Status.PAID, Order.Status.PAYMENT_REVIEW]
    assert inventory(stock) in [(1, 0, 1), (3, 0, 3)]
    succeed(payment)
    assert inventory(stock) in [(1, 0, 1), (3, 0, 3)]


@pytest.mark.django_db(transaction=True)
def test_concurrent_webhook_retries_consume_exactly_once(stock, monkeypatch, settings):
    order = checkout(cart_with(stock, 2))
    payment = pending_payment(order)
    verified_success(monkeypatch, settings)
    race(lambda: succeed(payment), lambda: succeed(payment))
    assert inventory(stock) == (1, 0, 1)
    order.refresh_from_db()
    assert order.status == Order.Status.PAID


@pytest.mark.django_db(transaction=True)
def test_concurrent_staff_recount_and_checkout_respect_reservation(stock, user):
    Product.objects.filter(pk=stock.pk).update(stock_quantity=1)
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    cart = cart_with(stock)
    outcomes = race(
        lambda: checkout(cart),
        lambda: adjust_stock(
            product_id=stock.pk, quantity=0, actor=user, reason="Recount"
        ),
    )
    assert (
        sum(
            isinstance(outcome, (InsufficientStock, ValidationError))
            for outcome in outcomes
        )
        == 1
    )
    assert inventory(stock) in [(1, 1, 0), (0, 0, 0)]
    assert StockAdjustment.objects.count() == (1 if stock.stock_quantity == 0 else 0)


def test_public_request_cannot_write_inventory_counters(api_client, stock):
    response = api_client.post(
        reverse("cart-item-create"),
        {
            "product_id": str(stock.pk),
            "quantity": 1,
            "stock_quantity": 9000,
            "reserved_quantity": 0,
        },
        format="json",
    )
    assert response.status_code == 201
    token = response.headers["X-Cart-Token"]
    created = api_client.post(
        reverse("order-list-create"),
        {
            "delivery_address": "Synthetic",
            "guest_email": "buyer@example.test",
            "guest_phone": "+70000000000",
            "stock_quantity": 9000,
            "reserved_quantity": 0,
            "reservation_state": "consumed",
        },
        format="json",
        HTTP_X_CART_TOKEN=token,
    )
    assert created.status_code == 201
    assert inventory(stock) == (3, 1, 2)
    assert created.json()["reservation_state"] == "active"


def test_provider_amount_mismatch_does_not_consume_stock(stock, monkeypatch, settings):
    order = checkout(cart_with(stock, 2))
    payment = pending_payment(order)
    settings.YOOKASSA_WEBHOOK_IP_CHECK = False
    monkeypatch.setattr(
        "apps.payments.yookassa.get_payment",
        lambda provider_id: {
            "id": provider_id,
            "status": "succeeded",
            "amount": {"value": "0.01", "currency": "RUB"},
            "test": True,
        },
    )
    with pytest.raises(ValidationError):
        succeed(payment)
    assert inventory(stock) == (3, 2, 1)
    payment.refresh_from_db()
    order.refresh_from_db()
    assert payment.status == Payment.Status.PENDING
    assert order.status == Order.Status.PENDING


@pytest.mark.django_db(transaction=True)
def test_concurrent_expiry_and_success_release_or_review_once(
    stock, monkeypatch, settings
):
    order = checkout(cart_with(stock, 2))
    payment = pending_payment(order)
    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timedelta(seconds=1)
    )
    verified_success(monkeypatch, settings)
    race(lambda: expire_stock_reservations(), lambda: succeed(payment))
    assert inventory(stock) == (3, 0, 3)
    payment.refresh_from_db()
    order.refresh_from_db()
    assert payment.status == Payment.Status.SUCCEEDED
    assert order.status == Order.Status.PAYMENT_REVIEW
    assert order.reservation_state == Order.ReservationState.RELEASED


@pytest.mark.django_db(transaction=True)
def test_concurrent_cart_adds_validate_final_quantity(stock):
    Product.objects.filter(pk=stock.pk).update(stock_quantity=1)
    cart = Cart.objects.create(cart_token=uuid4())
    outcomes = race(
        lambda: add_item(cart=cart, product_id=stock.pk, quantity=1),
        lambda: add_item(cart=cart, product_id=stock.pk, quantity=1),
    )
    assert sum(isinstance(outcome, InsufficientStock) for outcome in outcomes) == 1
    assert cart.items.get().quantity == 1
    assert inventory(stock) == (1, 0, 1)

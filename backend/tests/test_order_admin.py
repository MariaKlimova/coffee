"""Admin access must not bypass checkout snapshots or payment services."""

from decimal import Decimal

import pytest
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import RequestFactory
from django.urls import reverse

from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment

pytestmark = pytest.mark.django_db


@pytest.fixture
def purchase(user, products):
    order = Order.objects.create(
        user=user,
        delivery_address="Synthetic address",
        total_amount=Decimal("1000.00"),
    )
    item = OrderItem.objects.create(
        order=order,
        product=products["cheap"],
        product_name="Snapshot coffee",
        product_price=Decimal("500.00"),
        quantity=2,
    )
    payment = Payment.objects.create(
        order=order,
        provider_payment_id="synthetic-admin-payment",
        amount=order.total_amount,
        raw_payload={"test": True},
    )
    return order, item, payment


@pytest.fixture
def staff_factory():
    def create(*permissions, superuser=False):
        account = get_user_model().objects.create_user(
            email="staff@example.com",
            password="SyntheticPass1",
            is_staff=True,
            is_superuser=superuser,
        )
        for model, action in permissions:
            account.user_permissions.add(
                Permission.objects.get(
                    content_type__app_label=model._meta.app_label,
                    codename=f"{action}_{model._meta.model_name}",
                )
            )
        return account

    return create


def admin_url(model, action, obj=None):
    return reverse(
        f"admin:{model._meta.app_label}_{model._meta.model_name}_{action}",
        args=[obj.pk] if obj else None,
    )


def snapshots():
    return {
        model: list(model.objects.order_by("pk").values())
        for model in (Order, OrderItem, Payment)
    }


@pytest.mark.parametrize("identity", ["guest", "buyer", "staff"])
def test_unprivileged_accounts_cannot_access_financial_admin(
    client, user, staff_factory, purchase, identity
):
    if identity != "guest":
        client.force_login(user if identity == "buyer" else staff_factory())
    expected = 403 if identity == "staff" else 302
    before = snapshots()
    for obj in purchase:
        model = type(obj)
        assert client.get(admin_url(model, "changelist")).status_code == expected
        assert client.get(admin_url(model, "change", obj)).status_code == expected
        assert (
            client.post(admin_url(model, "change", obj), {"status": "paid"}).status_code
            == expected
        )
    assert snapshots() == before


@pytest.mark.parametrize("permission", ["view", "change"])
def test_model_permissions_preserve_browsing_without_granting_other_models(
    client, staff_factory, purchase, permission
):
    order, item, payment = purchase
    client.force_login(staff_factory((Payment, permission)))
    assert client.get(admin_url(Payment, "changelist")).status_code == 200
    response = client.get(admin_url(Payment, "change", payment))
    assert response.status_code == 200
    assert not response.context["has_change_permission"]
    assert not response.context["has_add_permission"]
    assert not response.context["has_delete_permission"]
    assert not response.context["adminform"].form.fields
    for obj in (order, item):
        assert client.get(admin_url(type(obj), "change", obj)).status_code == 403


@pytest.mark.parametrize("model", [Order, OrderItem, Payment])
@pytest.mark.parametrize("permission", ["view", "change"])
def test_authorized_staff_can_browse_order_and_payment_records(
    client, staff_factory, purchase, model, permission
):
    obj = next(obj for obj in purchase if isinstance(obj, model))
    client.force_login(staff_factory((model, permission)))
    response = client.get(admin_url(model, "change", obj))
    assert response.status_code == 200
    assert not response.context["has_add_permission"]
    assert not response.context["has_delete_permission"]
    fields = response.context["adminform"].form.fields
    assert "status" not in fields
    assert "total_amount" not in fields
    if model is not Order:
        assert not fields


@pytest.mark.parametrize("model", [Order, OrderItem, Payment])
def test_even_superuser_cannot_create_delete_or_bulk_delete_records(
    client, staff_factory, purchase, model
):
    client.force_login(staff_factory(superuser=True))
    obj = next(obj for obj in purchase if isinstance(obj, model))
    before = snapshots()
    for method in (client.get, client.post):
        assert method(admin_url(model, "add")).status_code == 403
        assert method(admin_url(model, "delete", obj)).status_code == 403
    response = client.post(
        admin_url(model, "changelist"),
        {"action": "delete_selected", "_selected_action": str(obj.pk), "post": "yes"},
    )
    assert response.status_code == 200
    assert not response.context["action_form"]
    assert snapshots() == before


@pytest.mark.parametrize("model", [OrderItem, Payment])
def test_forged_standalone_post_cannot_modify_readonly_records(
    client, staff_factory, purchase, model, products
):
    client.force_login(staff_factory(superuser=True))
    order, item, payment = purchase
    obj = item if model is OrderItem else payment
    before = snapshots()
    response = client.post(
        admin_url(model, "change", obj),
        {
            "order": str(order.pk),
            "status": Payment.Status.SUCCEEDED,
            "amount": "0.01",
            "provider_payment_id": "forged-provider",
            "raw_payload": '{"forged": true}',
            "confirmation_url": "https://example.com/forged",
            "product": str(products["pricey"].pk),
            "product_name": "Forged snapshot",
            "product_price": "0.01",
            "quantity": "999",
            "_save": "Save",
        },
    )
    assert response.status_code == 403
    assert snapshots() == before


def test_order_contact_edit_ignores_forged_financial_and_inline_changes(
    client, staff_factory, purchase, products
):
    client.force_login(
        staff_factory((Order, "change"), (OrderItem, "change"), (OrderItem, "delete"))
    )
    order, item, payment = purchase
    item_before = list(OrderItem.objects.values())
    payment_before = list(Payment.objects.values())
    response = client.post(
        admin_url(Order, "change", order),
        {
            "user": str(order.user_id),
            "delivery_address": "Updated synthetic address",
            "status": Order.Status.PAID,
            "total_amount": "0.01",
            "items-TOTAL_FORMS": "2",
            "items-INITIAL_FORMS": "1",
            "items-MIN_NUM_FORMS": "0",
            "items-MAX_NUM_FORMS": "1000",
            "items-0-id": str(item.pk),
            "items-0-order": str(order.pk),
            "items-0-product_name": "Forged snapshot",
            "items-0-product_price": "0.01",
            "items-0-quantity": "999",
            "items-0-DELETE": "on",
            "items-1-order": str(order.pk),
            "items-1-product": str(products["pricey"].pk),
            "items-1-product_name": "Forged extra line",
            "items-1-product_price": "0.01",
            "items-1-quantity": "999",
            "_save": "Save",
        },
    )
    assert response.status_code == 302
    order.refresh_from_db()
    assert order.delivery_address == "Updated synthetic address"
    assert order.status == Order.Status.PENDING
    assert order.total_amount == Decimal("1000.00")
    assert list(OrderItem.objects.values()) == item_before
    assert list(Payment.objects.values()) == payment_before


def test_superuser_sees_existing_inline_snapshots_without_mutation_controls(
    client, staff_factory, purchase
):
    client.force_login(staff_factory(superuser=True))
    order, item, _payment = purchase
    response = client.get(admin_url(Order, "change", order))
    assert response.status_code == 200
    inline = response.context["inline_admin_formsets"][0]
    assert list(inline.formset.queryset) == [item]
    assert not inline.has_add_permission
    assert not inline.has_change_permission
    assert not inline.has_delete_permission
    assert not inline.formset.can_delete
    request = RequestFactory().get("/admin/")
    request.user = response.wsgi_request.user
    assert not admin.site._registry[Order].get_actions(request)


def test_webhook_still_pays_order_after_rejected_admin_mutation(
    client, staff_factory, purchase, api_client, monkeypatch, settings
):
    order, _item, payment = purchase
    client.force_login(staff_factory(superuser=True))
    assert (
        client.post(
            admin_url(Payment, "change", payment),
            {"status": Payment.Status.SUCCEEDED, "_save": "Save"},
        ).status_code
        == 403
    )
    settings.YOOKASSA_WEBHOOK_IP_CHECK = True
    calls = []

    def get_provider_payment(provider_id):
        calls.append(provider_id)
        return {
            "id": provider_id,
            "status": "succeeded",
            "amount": {"value": "1000.00", "currency": "RUB"},
            "paid": True,
            "test": True,
        }

    monkeypatch.setattr("apps.payments.yookassa.get_payment", get_provider_payment)
    payload = {
        "type": "notification",
        "event": "payment.succeeded",
        "object": {"id": payment.provider_payment_id, "status": "succeeded"},
    }
    for _ in range(2):
        response = api_client.post(
            reverse("payment-webhook"),
            payload,
            format="json",
            REMOTE_ADDR="185.71.76.1",
        )
        assert response.status_code == 200
    payment.refresh_from_db()
    order.refresh_from_db()
    assert calls == [payment.provider_payment_id] * 2
    assert payment.status == Payment.Status.SUCCEEDED
    assert order.status == Order.Status.PAID
    assert order.total_amount == Decimal("1000.00")
    assert Payment.objects.filter(order=order).count() == 1

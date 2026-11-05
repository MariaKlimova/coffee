"""Admin uses the same workflow and never writes stale financial fields."""

from uuid import uuid4

import pytest
from django.contrib import admin
from django.contrib.auth.models import Permission
from django.test import Client, RequestFactory
from django.urls import reverse

from apps.orders.models import Order, OrderStatusTransition
from apps.orders.workflow import transition_order
from tests import test_order_workflow as workflow_cases

pytestmark = pytest.mark.django_db
staff = workflow_cases.staff
purchase = workflow_cases.purchase
confirm = workflow_cases.confirm
stock = workflow_cases.stock


def grant(staff, action="change"):
    staff.user_permissions.add(
        Permission.objects.get(
            codename=f"{action}_order", content_type__app_label="orders"
        )
    )


def url(order):
    return reverse("admin:orders_order_transition", args=[order.pk])


def body(status="pending", target="cancelled", **kwargs):
    return {
        "expected_status": status,
        "to_status": target,
        "request_id": str(uuid4()),
        "comment": "Admin action",
        "confirm": "on",
        **kwargs,
    }


def test_admin_transition_requires_model_change_permission(client, staff, purchase):
    order, _, _ = purchase
    grant(staff, "view")
    client.force_login(staff)
    assert client.get(url(order)).status_code == 403
    assert client.post(url(order), body()).status_code == 403
    assert order.status_history.count() == 0
    response = client.get(reverse("admin:orders_order_change", args=[order.pk]))
    assert response.status_code == 200


def test_admin_cancel_uses_service_and_has_readonly_history(client, staff, purchase):
    order, product, _ = purchase
    grant(staff)
    client.force_login(staff)
    response = client.get(url(order))
    assert response.status_code == 200
    assert list(response.context_data["form"].fields["to_status"].choices) == [
        ("cancelled", "Cancelled")
    ]
    response = client.post(url(order), body(comment="<script>Synthetic</script>"))
    assert response.status_code == 302
    order.refresh_from_db()
    assert order.status == "cancelled" and stock(product) == (5, 0, 5)
    event = order.status_history.get()
    assert event.actor_id == staff.pk and event.source == "staff"
    response = client.get(url(order))
    assert b"&lt;script&gt;Synthetic&lt;/script&gt;" in response.content
    assert b"<script>Synthetic</script>" not in response.content
    assert not response.context_data["allowed_actions"]
    history_admin = admin.site._registry[OrderStatusTransition]
    request = RequestFactory().post("/admin/")
    request.user = staff
    assert not history_admin.has_add_permission(request)
    assert not history_admin.has_change_permission(request, event)
    assert not history_admin.has_delete_permission(request, event)


def test_admin_csrf_confirmation_and_forged_target_cannot_bypass(
    client, staff, purchase
):
    order, product, _ = purchase
    grant(staff)
    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(staff)
    assert csrf_client.post(url(order), body()).status_code == 403
    client.force_login(staff)
    assert client.post(url(order), body(confirm="")).status_code == 400
    assert client.post(url(order), body(target="paid")).status_code == 409
    assert order.status_history.count() == 0 and stock(product) == (5, 2, 3)


def test_admin_duplicate_and_stale_requests_share_service_semantics(
    client, staff, purchase, confirm
):
    order, product, payment = purchase
    confirm(payment)
    grant(staff)
    client.force_login(staff)
    data = body(status="paid", target="processing")
    assert client.post(url(order), data).status_code == 302
    assert client.post(url(order), data).status_code == 302
    assert (
        client.post(url(order), body(status="paid", target="cancelled")).status_code
        == 409
    )
    order.refresh_from_db()
    assert order.status == "processing" and stock(product) == (3, 0, 3)
    assert order.status_history.count() == 2


def test_stale_admin_contact_save_cannot_restore_workflow_snapshot(
    staff, purchase, confirm
):
    order, product, payment = purchase
    stale = Order.objects.get(pk=order.pk)
    confirm(payment)
    transition_order(
        order_id=order.pk,
        actor=staff,
        expected_status="paid",
        to_status="cancelled",
        request_id=uuid4(),
    )
    stale.delivery_address = "Updated synthetic address"
    stale.status = "paid"
    stale.reservation_state = "active"
    stale.total_amount = "0.01"
    request = RequestFactory().post("/admin/")
    request.user = staff
    admin.site._registry[Order].save_model(request, stale, None, True)
    order.refresh_from_db()
    assert order.delivery_address == "Updated synthetic address"
    assert order.status == "cancelled" and order.reservation_state == "restored"
    assert str(order.total_amount) == "1000.00" and stock(product) == (5, 0, 5)


def test_admin_legacy_cancellation_explains_no_inventory_increase(client, staff):
    grant(staff)
    client.force_login(staff)
    order = Order.objects.create(
        status="paid", total_amount="1.00", delivery_address="Legacy"
    )
    response = client.get(url(order))
    assert "количество товара не увеличится" in response.content.decode()
    assert "Деньги автоматически не возвращаются" in response.content.decode()

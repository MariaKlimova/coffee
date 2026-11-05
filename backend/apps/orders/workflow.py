"""One authorized, concurrency-safe staff transition boundary for API and admin."""

from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import (
    APIException,
    NotFound,
    PermissionDenied,
    ValidationError,
)

from apps.orders.history import record_status_transition
from apps.orders.models import Order, OrderStatusTransition
from apps.orders.services import _release_locked, restore_paid_stock

FULFILLMENT_NEXT = {
    Order.Status.PAID: Order.Status.PROCESSING,
    Order.Status.PROCESSING: Order.Status.SHIPPED,
    Order.Status.SHIPPED: Order.Status.DELIVERED,
}


class OrderTransitionConflict(APIException):
    status_code = 409
    default_code = "transition_not_allowed"
    default_detail = "This order transition is not allowed."


def allowed_order_transitions(order):
    """Shared UI metadata and service matrix; reads never change an order."""
    actions = []
    next_status = FULFILLMENT_NEXT.get(order.status)
    if next_status:
        actions.append(
            {
                "to_status": next_status,
                "inventory_effect": "none",
                "inventory_reason": None,
            }
        )
    state = order.reservation_state
    effect = None
    if order.status == Order.Status.PENDING:
        payments = getattr(order, "_prefetched_objects_cache", {}).get("payments")
        paid = (
            any(payment.status == "succeeded" for payment in payments)
            if payments is not None
            else order.payments.filter(status="succeeded").exists()
        )
        if not paid:
            if state == Order.ReservationState.ACTIVE:
                effect = "release_reservation"
            elif state in (
                Order.ReservationState.NONE,
                Order.ReservationState.RELEASED,
            ):
                effect = "none"
    elif order.status in (Order.Status.PAID, Order.Status.PROCESSING):
        if state == Order.ReservationState.CONSUMED:
            effect = "restore_stock"
        elif state == Order.ReservationState.NONE:
            effect = "none"
    if effect is not None:
        actions.append(
            {
                "to_status": Order.Status.CANCELLED,
                "inventory_effect": effect,
                "inventory_reason": (
                    "legacy_uncounted" if state == Order.ReservationState.NONE else None
                ),
            }
        )
    return actions


@transaction.atomic
def transition_order(
    *, order_id, actor, expected_status, to_status, request_id, comment=""
):
    """Apply once or replay the same intent, returning (current order, replayed)."""
    if (
        not getattr(actor, "is_authenticated", False)
        or not get_user_model()
        .objects.filter(pk=actor.pk, is_active=True, is_staff=True)
        .exists()
    ):
        raise PermissionDenied("Only active staff can process orders.")
    for field, value in (
        ("expected_status", expected_status),
        ("to_status", to_status),
    ):
        if value not in Order.Status.values:
            raise ValidationError({field: ["Unknown order status."]})
    try:
        request_id = UUID(str(request_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValidationError({"request_id": ["A valid UUID is required."]}) from exc
    if not isinstance(comment, str) or len(comment.strip()) > 500:
        raise ValidationError({"comment": ["Use at most 500 characters."]})
    comment = comment.strip()
    try:
        order = Order.objects.select_for_update().get(pk=order_id)
    except Order.DoesNotExist as exc:
        raise NotFound("Order not found.") from exc
    prior = order.status_history.filter(request_id=request_id).first()
    if prior:
        if (
            prior.actor_id != actor.pk
            or prior.from_status != expected_status
            or prior.to_status != to_status
            or prior.comment != comment
        ):
            raise OrderTransitionConflict(
                "This request ID was already used for another action.",
                code="idempotency_conflict",
            )
        return order, True
    if order.status != expected_status:
        raise OrderTransitionConflict(
            "The order changed. Refresh it before confirming another action.",
            code="order_status_conflict",
        )
    action = next(
        (
            action
            for action in allowed_order_transitions(order)
            if action["to_status"] == to_status
        ),
        None,
    )
    if action is None:
        raise OrderTransitionConflict()
    previous_status = order.status
    if action["inventory_effect"] == "release_reservation":
        _release_locked(order)
    elif action["inventory_effect"] == "restore_stock":
        restore_paid_stock(order)
    order.status = to_status
    order.save(update_fields=["status", "reservation_state", "updated_at"])
    record_status_transition(
        order,
        previous_status,
        source=OrderStatusTransition.Source.STAFF,
        actor=actor,
        comment=comment,
        request_id=request_id,
    )
    return order, False

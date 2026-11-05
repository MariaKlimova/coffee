"""Separate authorized buyer boundary; staff privileges never imply ownership."""

import secrets
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.orders.guest_access import body_digest, digest
from apps.orders.models import (
    CancellationRequest,
    Order,
    OrderActionIntent,
    OrderStatusTransition,
)
from apps.orders.workflow import (
    OrderTransitionConflict,
    _apply_locked_transition,
    allowed_order_transitions,
)


def authorize_buyer(order, *, actor, token=""):
    if getattr(actor, "is_authenticated", False):
        if (
            order.user_id == actor.pk
            and get_user_model().objects.filter(pk=actor.pk, is_active=True).exists()
        ):
            return f"user:{actor.pk}"
    elif (
        order.user_id is None
        and order.guest_action_digest
        and isinstance(token, str)
        and token
        and secrets.compare_digest(digest(token), order.guest_action_digest)
    ):
        return f"guest:{order.pk}"
    raise NotFound("Order not found.")


def lock_order(order_id):
    try:
        return Order.objects.select_for_update().get(pk=order_id)
    except Order.DoesNotExist as exc:
        raise NotFound("Order not found.") from exc


def ensure_intent(order, request_id, *, actor_key, kind, body):
    try:
        request_id = UUID(str(request_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValidationError({"request_id": ["A valid UUID is required."]}) from exc
    fingerprint = body_digest(body)
    prior = order.action_intents.filter(request_id=request_id).first()
    if (
        prior
        and (
            prior.actor_key != actor_key
            or prior.kind != kind
            or prior.body_digest != fingerprint
        )
    ) or (not prior and order.status_history.filter(request_id=request_id).exists()):
        raise OrderTransitionConflict(
            "This request ID was already used for another action.",
            code="idempotency_conflict",
        )
    return prior, dict(
        order=order,
        request_id=request_id,
        actor_key=actor_key,
        kind=kind,
        body_digest=fingerprint,
    )


def buyer_allowed_actions(order):
    if order.cancellation_requests.filter(state="open").exists():
        return []
    can_cancel = any(
        action["to_status"] == "cancelled"
        for action in allowed_order_transitions(order)
    )
    if not can_cancel:
        return []
    return ["cancel"] if order.status == "pending" else ["request_cancellation"]


def bounded_text(value, field, *, required=False):
    if (
        not isinstance(value, str)
        or len(value.strip()) > 500
        or required
        and not value.strip()
    ):
        raise ValidationError(
            {
                field: [
                    (
                        "Use between 1 and 500 characters."
                        if required
                        else "Use at most 500 characters."
                    )
                ]
            }
        )
    return value.strip()


@transaction.atomic
def cancel_by_buyer(
    *, order_id, actor, token="", request_id, expected_status, reason=""
):
    order = lock_order(order_id)
    principal = authorize_buyer(order, actor=actor, token=token)
    reason = bounded_text(reason, "reason")
    prior, intent = ensure_intent(
        order,
        request_id,
        actor_key=principal,
        kind="buyer_cancel",
        body=dict(expected_status=expected_status, reason=reason),
    )
    if prior:
        return order, True
    if expected_status != "pending" or order.status != expected_status:
        raise OrderTransitionConflict(
            "The order changed. Refresh it before confirming another action.",
            code="order_status_conflict",
        )
    if "cancel" not in buyer_allowed_actions(order):
        raise OrderTransitionConflict()
    _apply_locked_transition(
        order,
        to_status="cancelled",
        source=OrderStatusTransition.Source.BUYER,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        comment=reason,
        request_id=request_id,
    )
    OrderActionIntent.objects.create(**intent)
    return order, False


@transaction.atomic
def request_cancellation(
    *, order_id, actor, token="", request_id, expected_status, reason
):
    order = lock_order(order_id)
    principal = authorize_buyer(order, actor=actor, token=token)
    reason = bounded_text(reason, "reason", required=True)
    prior, intent = ensure_intent(
        order,
        request_id,
        actor_key=principal,
        kind="buyer_request",
        body=dict(expected_status=expected_status, reason=reason),
    )
    if prior:
        return order, True
    if order.status != expected_status or expected_status not in ("paid", "processing"):
        raise OrderTransitionConflict(
            "The order changed. Refresh it before confirming another action.",
            code="order_status_conflict",
        )
    if order.cancellation_requests.filter(state="open").exists():
        raise OrderTransitionConflict(
            "A cancellation request is already open.", code="cancellation_request_open"
        )
    if "request_cancellation" not in buyer_allowed_actions(order):
        raise OrderTransitionConflict()
    request = CancellationRequest.objects.create(
        order=order, requester_key=principal, reason=reason
    )
    OrderActionIntent.objects.create(**intent, cancellation_request=request)
    return order, False


@transaction.atomic
def decide_cancellation(
    *,
    order_id,
    cancellation_id,
    actor,
    request_id,
    decision,
    expected_status,
    public_response,
    private_comment="",
):
    if (
        not getattr(actor, "is_authenticated", False)
        or not get_user_model()
        .objects.filter(pk=actor.pk, is_active=True, is_staff=True)
        .exists()
    ):
        raise PermissionDenied("Only active staff can process orders.")
    order = lock_order(order_id)
    public_response = bounded_text(public_response, "public_response", required=True)
    private_comment = bounded_text(private_comment, "private_comment")
    if decision not in ("accept", "decline"):
        raise ValidationError({"decision": ["Choose accept or decline."]})
    try:
        cancellation_id = UUID(str(cancellation_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise NotFound("Cancellation request not found.") from exc
    prior, intent = ensure_intent(
        order,
        request_id,
        actor_key=f"staff:{actor.pk}",
        kind="staff_decision",
        body=dict(
            cancellation_id=str(cancellation_id),
            decision=decision,
            expected_status=expected_status,
            public_response=public_response,
            private_comment=private_comment,
        ),
    )
    if prior:
        return order, True
    try:
        request = order.cancellation_requests.select_for_update().get(
            pk=cancellation_id
        )
    except CancellationRequest.DoesNotExist as exc:
        raise NotFound("Cancellation request not found.") from exc
    if order.status != expected_status or order.status not in ("paid", "processing"):
        raise OrderTransitionConflict(
            "The order changed. Refresh it before confirming another action.",
            code="order_status_conflict",
        )
    if request.state != "open":
        raise OrderTransitionConflict(
            "This request was already decided.", code="cancellation_request_conflict"
        )
    if not any(
        action["to_status"] == "cancelled"
        for action in allowed_order_transitions(order)
    ):
        raise OrderTransitionConflict()
    # Close explicitly before lifecycle hook so public response cannot be overwritten.
    request.state = "accepted" if decision == "accept" else "declined"
    request.public_response = public_response
    request.private_comment = private_comment
    request.decided_at = timezone.now()
    request.decided_by = actor
    request.decided_by_label = f"Сотрудник #{actor.pk}"
    request.save()
    if decision == "accept":
        _apply_locked_transition(
            order,
            to_status="cancelled",
            source=OrderStatusTransition.Source.STAFF,
            actor=actor,
            comment=private_comment,
            request_id=request_id,
        )
    OrderActionIntent.objects.create(**intent, cancellation_request=request)
    return order, False

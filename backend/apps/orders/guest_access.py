"""Order-scoped guest secrets; immutable checkout proof survives Cart deletion."""

import hashlib
import json
import secrets
from uuid import UUID

from django.db import transaction
from rest_framework.exceptions import NotFound, ValidationError

from apps.orders.models import Order

ACTION_TOKEN_HEADER = "X-Order-Action-Token"


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def body_digest(body):
    return digest(json.dumps(body, sort_keys=True, separators=(",", ":"), default=str))


def cart_proof(raw):
    try:
        return digest(str(UUID(str(raw))))
    except (ValueError, TypeError, AttributeError):
        return ""


def issue_guest_token(order):
    """Creation or Order-locked recovery only. Raw token never persists."""
    token = secrets.token_urlsafe(32)
    order.guest_action_digest = digest(token)
    order.guest_action_version += 1
    order.save(update_fields=["guest_action_digest", "guest_action_version"])
    return token


@transaction.atomic
def recover_guest_checkout(*, checkout_request_id, original_cart_token, actor):
    if getattr(actor, "is_authenticated", False):
        raise NotFound("Order not found.")
    try:
        order = Order.objects.select_for_update().get(
            checkout_request_id=checkout_request_id, user__isnull=True
        )
    except Order.DoesNotExist as exc:
        raise NotFound("Order not found.") from exc
    proof = cart_proof(original_cart_token)
    if (
        not proof
        or not order.checkout_proof_digest
        or not secrets.compare_digest(proof, order.checkout_proof_digest)
    ):
        raise NotFound("Order not found.")
    return order, issue_guest_token(order)


def validate_checkout_intent_for_user(user, checkout_request_id):
    if getattr(user, "is_authenticated", False) and checkout_request_id is not None:
        raise ValidationError(
            {
                "checkout_request_id": [
                    "Checkout recovery is supported for guest checkout only."
                ]
            }
        )


def reject_checkout_replay(order, *, original_cart_token, body):
    """Never disclose a previous checkout or intent to a foreign cart bearer."""
    from apps.orders.workflow import OrderTransitionConflict

    proof = cart_proof(original_cart_token)
    if (
        not proof
        or not order.checkout_proof_digest
        or not secrets.compare_digest(proof, order.checkout_proof_digest)
    ):
        raise NotFound("Order not found.")
    if order.checkout_body_digest != body_digest(body):
        raise OrderTransitionConflict(
            "This checkout intent was already used for another action.",
            code="idempotency_conflict",
        )
    raise OrderTransitionConflict(
        "Recover this guest checkout using its original proof.",
        code="checkout_recovery_required",
    )

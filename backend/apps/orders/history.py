"""Record actual lifecycle changes inside the caller's order transaction."""

from apps.orders.models import OrderStatusTransition


def record_status_transition(
    order, previous_status, *, source, actor=None, comment="", request_id=None
):
    if order.status == previous_status:
        return None
    return OrderStatusTransition.objects.create(
        order=order,
        from_status=previous_status,
        to_status=order.status,
        source=source,
        actor=actor,
        actor_label=f"Сотрудник #{actor.pk}" if actor else "",
        comment=comment,
        request_id=request_id,
    )

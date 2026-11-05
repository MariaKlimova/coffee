"""Record actual lifecycle changes inside the caller's order transaction."""

from django.utils import timezone

from apps.orders.models import OrderStatusTransition


def record_status_transition(
    order, previous_status, *, source, actor=None, comment="", request_id=None
):
    if order.status == previous_status:
        return None
    if order.status in ("cancelled", "shipped", "delivered", "payment_review"):
        accepted = order.status == "cancelled"
        order.cancellation_requests.filter(state="open").update(
            state="accepted" if accepted else "closed_unavailable",
            public_response=(
                "Заказ отменён. По вопросам возврата оплаты обратись в магазин."
                if accepted
                else "Отмена сейчас недоступна. Обратись в магазин."
            ),
            decided_at=timezone.now(),
            decided_by=actor,
            decided_by_label=(
                f"Сотрудник #{actor.pk}" if actor and source == "staff" else ""
            ),
        )
    return OrderStatusTransition.objects.create(
        order=order,
        from_status=previous_status,
        to_status=order.status,
        source=source,
        actor=actor,
        actor_label=(
            (f"Покупатель #{actor.pk}" if actor else "Покупатель")
            if source == "buyer"
            else (f"Сотрудник #{actor.pk}" if actor else "")
        ),
        comment=comment,
        request_id=request_id,
    )

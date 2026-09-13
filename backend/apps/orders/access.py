"""Order access helpers shared by orders and payments."""

from __future__ import annotations

from rest_framework.request import Request

from apps.orders.models import Order


def can_view_order(request: Request, order: Order) -> bool:
    """
    Whether the caller may see or act on the order.

    Authenticated owner or staff may access any of their / all orders.
    Anonymous callers may only access guest orders (``user`` is null),
    typically by knowing the order UUID after checkout.
    """
    user = request.user
    if user is not None and user.is_authenticated:
        if user.is_staff:
            return True
        return order.user_id is not None and order.user_id == user.id
    return order.user_id is None

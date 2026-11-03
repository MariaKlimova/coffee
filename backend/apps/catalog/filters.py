"""Shared list filter validation for public and staff catalog scopes."""

from decimal import Decimal, InvalidOperation

from django.db.models import F, QuerySet
from rest_framework.exceptions import ValidationError

from apps.catalog.models import Product

ORDERING_MAP = {
    "price": ("price",),
    "-price": ("-price",),
    "created_at": ("created_at",),
    "-created_at": ("-created_at",),
}
ALLOWED_CATEGORIES = frozenset({"coffee", "machines"})


def _parse_bool(raw: str, *, field: str) -> bool:
    lowered = raw.lower()
    if lowered in {"true", "1", "yes"}:
        return True
    if lowered in {"false", "0", "no"}:
        return False
    raise ValidationError({field: [f"Must be a boolean (got {raw!r})."]})


def _parse_decimal(raw: str, *, field: str) -> Decimal:
    try:
        value = Decimal(raw)
    except InvalidOperation as exc:
        raise ValidationError(
            {field: [f"Must be a decimal string (got {raw!r})."]},
        ) from exc
    if not value.is_finite():
        raise ValidationError({field: ["Must be a finite decimal string."]})
    return value


def filter_products(qs: QuerySet[Product], params) -> QuerySet[Product]:

    category = params.get("category")
    if category is not None and category != "":
        if category not in ALLOWED_CATEGORIES:
            raise ValidationError(
                {
                    "category": [
                        "Must be one of: coffee, machines " f"(got {category!r})."
                    ],
                },
            )
        qs = qs.filter(category__slug=category)

    in_stock_raw = params.get("in_stock")
    if in_stock_raw is not None and in_stock_raw != "":
        available = _parse_bool(in_stock_raw, field="in_stock")
        if available:
            qs = qs.filter(stock_quantity__gt=F("reserved_quantity"))
        else:
            qs = qs.filter(stock_quantity=F("reserved_quantity"))

    price_min_raw = params.get("price_min")
    if price_min_raw is not None and price_min_raw != "":
        qs = qs.filter(
            price__gte=_parse_decimal(price_min_raw, field="price_min"),
        )

    price_max_raw = params.get("price_max")
    if price_max_raw is not None and price_max_raw != "":
        qs = qs.filter(
            price__lte=_parse_decimal(price_max_raw, field="price_max"),
        )

    search = params.get("search")
    if search:
        qs = qs.filter(name__icontains=search)

    ordering = params.get("ordering")
    if ordering is None or ordering == "":
        order_by = ORDERING_MAP["-created_at"]
    elif ordering in ORDERING_MAP:
        order_by = ORDERING_MAP[ordering]
    else:
        allowed = ", ".join(ORDERING_MAP)
        raise ValidationError(
            {
                "ordering": [
                    f"Must be one of: {allowed} (got {ordering!r}).",
                ],
            },
        )

    return qs.order_by(*order_by)

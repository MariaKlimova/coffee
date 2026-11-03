"""Validated staff order filters, independent of buyer visibility rules."""

import re
from datetime import UTC, datetime, time

from django.db.models import CharField, F, Func, Q, Value
from django.db.models.functions import Cast, Replace
from rest_framework import serializers

from apps.orders.models import Order


class ISODateField(serializers.DateField):
    def to_internal_value(self, value):
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            self.fail("invalid", format="YYYY-MM-DD")
        return super().to_internal_value(value)


class ManageOrderFiltersSerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True, max_length=255)
    status = serializers.ChoiceField(choices=Order.Status.choices, required=False)
    date_from = ISODateField(required=False)
    date_to = ISODateField(required=False)

    def validate(self, attrs):
        if (
            attrs.get("date_from")
            and attrs.get("date_to")
            and attrs["date_from"] > attrs["date_to"]
        ):
            raise serializers.ValidationError(
                {"date_to": ["Must be on or after date_from."]}
            )
        return attrs


def filter_manage_orders(queryset, params):
    serializer = ManageOrderFiltersSerializer(data=params)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    if status := data.get("status"):
        queryset = queryset.filter(status=status)
    for field, lookup, boundary in (
        ("date_from", "created_at__gte", time.min),
        ("date_to", "created_at__lte", time.max),
    ):
        if day := data.get(field):
            queryset = queryset.filter(
                **{lookup: datetime.combine(day, boundary, tzinfo=UTC)}
            )
    if search := data.get("search"):
        match = (
            Q(id__icontains=search)
            | Q(guest_email__icontains=search)
            | Q(guest_phone__icontains=search)
            | Q(user__email__icontains=search)
            | Q(user__phone__icontains=search)
        )
        if re.fullmatch(r"[0-9a-fA-F-]+", search) and (
            identifier := search.replace("-", "")
        ):
            queryset = queryset.alias(
                normalized_order_id=Replace(
                    Cast("id", CharField()), Value("-"), Value("")
                )
            )
            match |= Q(normalized_order_id__icontains=identifier)
        # A phone typed without presentation punctuation also finds formatted data.
        if re.fullmatch(r"[+\d\s().-]+", search) and (
            digits := re.sub(r"\D", "", search)
        ):
            aliases = {}
            for source in ("guest_phone", "user__phone"):
                alias = f"normalized_{source}"
                aliases[alias] = Func(
                    F(source),
                    Value(r"[^0-9]"),
                    Value(""),
                    Value("g"),
                    function="REGEXP_REPLACE",
                    output_field=CharField(),
                )
                match |= Q(**{f"{alias}__contains": digits})
            queryset = queryset.alias(**aliases)
        queryset = queryset.filter(match)
    return queryset

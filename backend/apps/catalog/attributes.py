"""Fixed attribute schemas for catalog products.

Category-specific traits stay in Product.attributes (JSON), but only the
keys below are allowed — with per-key types and ranges where needed.
Add a key here (and in OpenAPI) when a new field appears.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from django.core.exceptions import ValidationError

# Shared product columns (not in attributes JSON):
# name, short_description, price, old_price, description, images via ProductImage.

Validator = Callable[[Any], None]


def _is_plain_int(value: Any) -> bool:
    """True for int, but not bool (bool is a subclass of int in Python)."""
    return type(value) is int


def _require_str(key: str, value: Any) -> None:
    if not isinstance(value, str):
        raise ValidationError(
            {
                "attributes": (
                    f"Attribute {key!r} must be a string "
                    f"(got {type(value).__name__})."
                ),
            },
        )


def _require_int_in_range(
    key: str,
    value: Any,
    *,
    min_value: int,
    max_value: int,
) -> None:
    if not _is_plain_int(value):
        raise ValidationError(
            {
                "attributes": (
                    f"Attribute {key!r} must be an integer "
                    f"(got {type(value).__name__})."
                ),
            },
        )
    if value < min_value or value > max_value:
        raise ValidationError(
            {
                "attributes": (
                    f"Attribute {key!r} must be between "
                    f"{min_value} and {max_value} (got {value})."
                ),
            },
        )


def _require_non_negative_int(key: str, value: Any) -> None:
    if not _is_plain_int(value):
        raise ValidationError(
            {
                "attributes": (
                    f"Attribute {key!r} must be an integer "
                    f"(got {type(value).__name__})."
                ),
            },
        )
    if value < 0:
        raise ValidationError(
            {
                "attributes": (f"Attribute {key!r} must be >= 0 (got {value})."),
            },
        )


# Single source of truth: validators define allowed keys per category.
COFFEE_ATTRIBUTE_VALIDATORS: dict[str, Validator] = {
    "country": lambda v: _require_str("country", v),
    "intensity": lambda v: _require_int_in_range(
        "intensity", v, min_value=0, max_value=13
    ),
    "bitterness": lambda v: _require_int_in_range(
        "bitterness", v, min_value=0, max_value=5
    ),
    "acidity": lambda v: _require_int_in_range("acidity", v, min_value=0, max_value=5),
    "roast": lambda v: _require_int_in_range("roast", v, min_value=0, max_value=5),
    "density": lambda v: _require_int_in_range("density", v, min_value=0, max_value=5),
}

MACHINE_ATTRIBUTE_VALIDATORS: dict[str, Validator] = {
    "dimensions": lambda v: _require_str("dimensions", v),
    "pressure_bar": lambda v: _require_non_negative_int("pressure_bar", v),
    "power_w": lambda v: _require_non_negative_int("power_w", v),
    "capsule_format": lambda v: _require_str("capsule_format", v),
    "manufacturer_country": lambda v: _require_str("manufacturer_country", v),
}

ATTRIBUTE_VALIDATORS: dict[str, Validator] = {
    **COFFEE_ATTRIBUTE_VALIDATORS,
    **MACHINE_ATTRIBUTE_VALIDATORS,
}

ATTRIBUTES_BY_CATEGORY_SLUG: dict[str, frozenset[str]] = {
    "coffee": frozenset(COFFEE_ATTRIBUTE_VALIDATORS),
    "machines": frozenset(MACHINE_ATTRIBUTE_VALIDATORS),
}

# Backwards-compatible aliases for imports/docs.
COFFEE_ATTRIBUTE_KEYS = ATTRIBUTES_BY_CATEGORY_SLUG["coffee"]
MACHINE_ATTRIBUTE_KEYS = ATTRIBUTES_BY_CATEGORY_SLUG["machines"]


def validate_product_attributes(
    *,
    category_slug: str,
    attributes: Any,
) -> None:
    """
    Ensure attributes is a dict with only known keys and typed values.

    All attribute keys are optional; price lives on Product, not here.
    """
    if attributes is None:
        attributes = {}

    if not isinstance(attributes, dict):
        raise ValidationError(
            {"attributes": "Attributes must be a JSON object."},
        )

    allowed = ATTRIBUTES_BY_CATEGORY_SLUG.get(category_slug)
    if allowed is None:
        if attributes:
            raise ValidationError(
                {
                    "attributes": (
                        f"Unknown category slug {category_slug!r}; "
                        "attributes must be empty."
                    ),
                },
            )
        return

    unknown = set(attributes) - allowed
    if unknown:
        keys = ", ".join(sorted(unknown))
        allowed_list = ", ".join(sorted(allowed))
        raise ValidationError(
            {
                "attributes": (
                    f"Unknown attribute key(s): {keys}. "
                    f"Allowed for {category_slug}: {allowed_list}."
                ),
            },
        )

    category_validators = (
        COFFEE_ATTRIBUTE_VALIDATORS
        if category_slug == "coffee"
        else MACHINE_ATTRIBUTE_VALIDATORS
    )
    for key, value in attributes.items():
        if value is None:
            continue
        category_validators[key](value)

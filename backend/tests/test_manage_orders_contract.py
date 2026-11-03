"""Documented and generated staff order contracts match the read-only API."""

from pathlib import Path

import yaml
from drf_spectacular.generators import SchemaGenerator
from jsonschema import Draft202012Validator


def test_manage_order_endpoints_and_projection_are_documented():
    contract = yaml.safe_load(
        (Path(__file__).resolve().parents[2] / "docs/api/openapi.yaml").read_text()
    )
    for path in ("/api/manage/orders/", "/api/manage/orders/{id}/"):
        assert set(contract["paths"][path]) == {"get"}
        assert {"200", "401", "403", "404"} <= set(
            contract["paths"][path]["get"]["responses"]
        )
    payment = contract["components"]["schemas"]["ManagePayment"]
    validator = Draft202012Validator(
        {**contract, "$ref": "#/components/schemas/ManagePayment"}
    )
    validator.validate(
        {
            "id": "00000000-0000-0000-0000-000000000059",
            "status": "succeeded",
            "amount": "1.00",
            "created_at": "2026-11-03T00:00:00Z",
            "updated_at": "2026-11-03T00:00:00Z",
        }
    )
    assert set(payment["properties"]) == {
        "id",
        "status",
        "amount",
        "created_at",
        "updated_at",
    }


def test_generated_schema_exposes_read_only_paginated_staff_endpoints():
    schema = SchemaGenerator().get_schema(request=None, public=True)
    listing = schema["paths"]["/api/manage/orders/"]
    assert set(listing) == {"get"}
    params = {parameter["name"] for parameter in listing["get"]["parameters"]}
    assert {"search", "status", "date_from", "date_to", "page", "page_size"} <= params
    assert listing["get"]["security"] == [{"jwtAuth": []}]
    detail = schema["paths"]["/api/manage/orders/{id}/"]
    assert set(detail) == {"get"}
    payment = schema["components"]["schemas"]["ManagePayment"]
    assert set(payment["properties"]) == {
        "id",
        "status",
        "amount",
        "created_at",
        "updated_at",
    }

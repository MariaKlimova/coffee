"""The owner write contract must accept shared, empty category attributes."""

from pathlib import Path

import yaml
from jsonschema import Draft202012Validator


def test_write_schema_accepts_empty_attributes_for_both_categories():
    path = Path(__file__).resolve().parents[2] / "docs/api/openapi.yaml"
    contract = yaml.safe_load(path.read_text())
    schema = {**contract, "$ref": "#/components/schemas/ManageProductWrite"}
    validator = Draft202012Validator(schema)
    for category in ("coffee", "machines"):
        validator.validate({"category": category, "attributes": {}})
    validator.validate({"attributes": {}})  # PATCH may omit the unchanged category.

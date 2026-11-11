"""Manual and generated manage contracts cover the same protected operations."""

from pathlib import Path

import yaml
from drf_spectacular.generators import SchemaGenerator
from jsonschema import Draft202012Validator


def catalog_contract():
    path = Path(__file__).resolve().parents[2] / "docs/api/openapi.yaml"
    return yaml.safe_load(path.read_text())


def test_every_manage_route_and_method_is_documented_and_requires_jwt():
    contract = catalog_contract()
    generated = SchemaGenerator().get_schema(request=None, public=True)
    methods = {"get", "post", "patch", "put", "delete"}

    def operations(schema):
        return {
            (path, method): operation
            for path, path_item in schema["paths"].items()
            if path.startswith("/api/manage/")
            for method, operation in path_item.items()
            if method in methods
        }

    documented, actual = operations(contract), operations(generated)
    # Includes orders as well as catalog: a new manage route cannot be omitted.
    assert documented.keys() == actual.keys()
    for key, operation in documented.items():
        assert operation.get("security", contract.get("security")) == [
            {"bearerAuth": []}
        ], key
        assert actual[key]["security"] == [{"jwtAuth": []}], key
        assert {"401", "403"} <= operation["responses"].keys(), key
        assert {code for code in actual[key]["responses"] if code.startswith("2")} == {
            code for code in operation["responses"] if code.startswith("2")
        }, key


def test_generated_catalog_writes_and_gallery_match_documented_payloads():
    contract = catalog_contract()
    generated = SchemaGenerator().get_schema(request=None, public=True)
    catalog = "/api/manage/products/"
    image = "/api/manage/products/{id}/images/"
    image_detail = "/api/manage/products/{id}/images/{image_id}/"
    for schema in (contract, generated):
        upload = schema["paths"][image]["post"]
        assert set(upload["requestBody"]["content"]) == {"multipart/form-data"}
        assert {"201", "400", "401", "403", "404", "415", "503"} <= set(
            upload["responses"]
        )
        patch = schema["paths"][image_detail]["patch"]
        assert set(patch["requestBody"]["content"]) == {"application/json"}
        assert "415" in patch["responses"]
    create = generated["paths"][catalog]["post"]["requestBody"]["content"]
    write_ref = create["application/json"]["schema"]["$ref"].split("/")[-1]
    write = generated["components"]["schemas"][write_ref]
    assert set(write["required"]) == {
        "name",
        "category",
        "short_description",
        "price",
        "stock_quantity",
    }
    assert set(write["properties"]) == set(
        contract["components"]["schemas"]["ManageProductWrite"]["properties"]
    )
    for schema in (contract, generated):
        image_schema = schema["components"]["schemas"]["ManageProductImage"]
        # Draft uses allOf inheritance; generated schema is flattened.
        image_id = image_schema.get("properties", {}).get("id")
        if image_id is None:
            image_id = image_schema["allOf"][1]["properties"]["id"]
        assert image_id["type"] == "integer" and image_id["readOnly"] is True


def test_write_schema_accepts_empty_attributes_for_both_categories():
    contract = catalog_contract()
    schema = {**contract, "$ref": "#/components/schemas/ManageProductWrite"}
    validator = Draft202012Validator(schema)
    for category in ("coffee", "machines"):
        validator.validate({"category": category, "attributes": {}})
    validator.validate({"attributes": {}})  # PATCH may omit the unchanged category.

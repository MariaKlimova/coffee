"""Order position counts remain historical, isolated and bounded (COFFEE-39)."""

from pathlib import Path

import pytest
import yaml
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from drf_spectacular.generators import SchemaGenerator

from apps.orders.models import Order, OrderItem
from tests.helpers import auth_client

LIST = "/api/orders/"


def make_order(user, quantities=()):
    order = Order.objects.create(
        user=user, delivery_address="Synthetic address", total_amount="0.00"
    )
    OrderItem.objects.bulk_create(
        [
            OrderItem(
                order=order,
                product_name=f"Snapshot {index}",
                product_price="5.00",
                quantity=quantity,
            )
            for index, quantity in enumerate(quantities)
        ]
    )
    return order


@pytest.mark.django_db
def test_counts_positions_with_pagination_and_owner_isolation(api_client, user):
    auth_client(api_client, user)
    owned = [make_order(user, quantities) for quantities in [(), (4,), (2, 3)]]
    other = get_user_model().objects.create_user(email="other39@example.test")
    make_order(other, (1, 2, 3))
    make_order(None, (1, 2, 3, 4))

    first = api_client.get(LIST, {"page_size": 2})
    second = api_client.get(LIST, {"page_size": 2, "page": 2})

    assert first.status_code == second.status_code == 200
    assert first.data["count"] == second.data["count"] == 3
    assert first.data["next"] and second.data["next"] is None
    assert len(first.data["results"]) == 2 and len(second.data["results"]) == 1
    rows = first.data["results"] + second.data["results"]
    assert {row["id"]: row["items_count"] for row in rows} == {
        str(order.pk): count for count, order in enumerate(owned)
    }


@pytest.mark.django_db
def test_deleted_or_changed_product_keeps_snapshot_count(api_client, user, products):
    auth_client(api_client, user)
    order = make_order(user, (3,))
    product = products["cheap"]
    OrderItem.objects.create(
        order=order,
        product=product,
        product_name="Historical coffee",
        product_price="500.00",
        quantity=4,
    )
    product.price = "999.00"
    product.save(update_fields=["price"])
    for deleted in (False, True):
        if deleted:
            product.delete()
        listed = api_client.get(LIST)
        detail = api_client.get(f"{LIST}{order.pk}/")
        assert listed.status_code == detail.status_code == 200
        assert listed.data["results"][0]["items_count"] == 2
        assert detail.data["items_count"] == len(detail.data["items"]) == 2
        historical = next(
            item
            for item in detail.data["items"]
            if item["product_name"] == "Historical coffee"
        )
        assert historical["product_price"] == "500.00"
        assert historical["quantity"] == 4
        assert (historical["product_id"] is None) is deleted


@pytest.mark.django_db
def test_order_list_query_count_does_not_grow_per_order(api_client, user):
    auth_client(api_client, user)
    make_order(user, (2, 3))

    def read_list():
        with CaptureQueriesContext(connection) as queries:
            response = api_client.get(LIST)
        assert response.status_code == 200
        assert all(row["items_count"] == 2 for row in response.data["results"])
        assert all(q["sql"].lstrip().upper().startswith("SELECT") for q in queries)
        return len(queries)

    before = read_list()
    for _ in range(12):
        make_order(user, (2, 3))
    assert read_list() == before <= 4


def test_documented_and_generated_order_counts_are_required_read_only_integers():
    documented = yaml.safe_load(
        (Path(__file__).resolve().parents[2] / "docs/api/openapi.yaml").read_text()
    )["components"]["schemas"]
    generated = SchemaGenerator().get_schema(request=None, public=True)
    projections = [documented["OrderListItem"], documented["BuyerOrder"]] + [
        generated["components"]["schemas"][name]
        for name in (
            "OrderList",
            "Order",
            "BuyerOrder",
            "OrderCreateResponse",
            "ManageOrderList",
            "ManageOrder",
        )
    ]
    for projection in projections:
        assert "items_count" in projection["required"]
        count = projection["properties"]["items_count"]
        assert count["type"] == "integer"
        assert count["minimum"] == 0
        assert count["readOnly"] is True

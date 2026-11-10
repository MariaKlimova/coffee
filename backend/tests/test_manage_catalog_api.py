"""Staff catalog operations, provenance transition and real PostgreSQL races."""

from decimal import Decimal

import pytest
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APIClient

from apps.catalog.manage_services import disable_demo
from apps.catalog.models import (
    CatalogState,
    Category,
    Product,
    ProductImage,
    StockAdjustment,
)
from apps.catalog.services import InsufficientStock
from apps.favorites.models import Favorite
from apps.orders.models import Order
from tests.helpers import auth_client
from tests.test_inventory import cart_with, checkout, race

pytestmark = pytest.mark.django_db


@pytest.fixture
def staff(user):
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    return user


@pytest.fixture
def owner_client(staff):
    client = APIClient()
    auth_client(client, staff)
    return client


def detail(product):
    return reverse("manage-product-detail", args=[product.pk])


def payload():
    return {
        "name": "Кофе владельца",
        "category": "coffee",
        "short_description": "Свежая обжарка",
        "price": "750.00",
        "stock_quantity": 3,
        "attributes": {"intensity": 7},
    }


@pytest.mark.parametrize("role,expected", [("anonymous", 401), ("buyer", 403)])
def test_manage_requires_staff(api_client, user, products, role, expected):
    if role == "buyer":
        auth_client(api_client, user)
    product = products["cheap"]
    before = list(Product.objects.order_by("pk").values())
    state_before = list(CatalogState.objects.values())
    endpoints = [
        ("get", reverse("manage-product-list"), None),
        ("post", reverse("manage-product-list"), payload()),
        ("get", detail(product), None),
        ("patch", detail(product), {"stock_quantity": 300}),
        ("delete", detail(product), None),
        ("get", reverse("manage-catalog-list"), None),
        ("post", reverse("manage-catalog-disable-demo"), {}),
    ]
    for method, url, data in endpoints:
        response = getattr(api_client, method)(url, data, format="json")
        assert response.status_code == expected, response.json()
    product.refresh_from_db()
    assert product.stock_quantity == 100 and product.is_published
    assert list(Product.objects.order_by("pk").values()) == before
    assert not StockAdjustment.objects.exists()
    assert list(CatalogState.objects.values()) == state_before


def test_create_unique_slugs_edit_audited_stock_and_soft_hide(
    owner_client, products, staff
):
    first = owner_client.post(reverse("manage-product-list"), payload(), format="json")
    second = owner_client.post(reverse("manage-product-list"), payload(), format="json")
    assert first.status_code == second.status_code == 201
    data = first.json()
    assert data["origin"] == "owner" and data["stock_quantity"] == 3
    assert data["reserved_quantity"] == 0 and data["available_quantity"] == 3
    assert data["slug"] != second.json()["slug"]
    product = Product.objects.get(pk=data["id"])
    audit = StockAdjustment.objects.get(product=product)
    assert (audit.actor_id, audit.before_quantity, audit.after_quantity) == (
        staff.pk,
        0,
        3,
    )
    edited = owner_client.patch(
        detail(product),
        {
            "stock_quantity": 0,
            "price": "760.00",
            "name": "Новое название",
            "stock_change_reason": "Пересчёт остатков",
        },
        format="json",
    )
    assert edited.status_code == 200, edited.json()
    assert edited.json()["in_stock"] is False
    assert edited.json()["slug"] == data["slug"]
    public = APIClient().get(reverse("product-detail", args=[data["slug"]]))
    assert public.json()["available_quantity"] == 0
    assert public.json()["price"] == "760.00"
    assert owner_client.delete(detail(product)).status_code == 204
    assert Product.objects.filter(pk=product.pk).exists()
    assert StockAdjustment.objects.filter(product=product).count() == 2
    assert (
        APIClient().get(reverse("product-detail", args=[data["slug"]])).status_code
        == 404
    )
    assert owner_client.get(detail(product)).json()["hidden_reason"] == "unpublished"


@pytest.mark.parametrize("quantity", [-1, 1.5, "3", True, None, 2147483648])
def test_invalid_quantity_is_field_error_and_atomic(owner_client, products, quantity):
    product = products["cheap"]
    response = owner_client.patch(
        detail(product),
        {
            "stock_quantity": quantity,
            "name": "Must roll back",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "stock_quantity" in response.json()["errors"]
    product.refresh_from_db()
    assert product.stock_quantity == 100 and product.name != "Must roll back"
    assert not StockAdjustment.objects.exists()


@pytest.mark.parametrize(
    "changes,field",
    [
        ({"attributes": {"pressure_bar": 15}}, "attributes"),
        ({"attributes": {"roast": 6}}, "attributes"),
        ({"category": "machines", "attributes": {"intensity": 7}}, "attributes"),
        ({"old_price": "1.00"}, "old_price"),
        ({"price": "-1.00"}, "price"),
        ({"reserved_quantity": 0}, "reserved_quantity"),
        ({"in_stock": True}, "in_stock"),
        ({"origin": "demo"}, "origin"),
        ({"slug": "override"}, "slug"),
    ],
)
def test_product_validation_and_server_owned_fields(
    owner_client, products, changes, field
):
    Category.objects.get_or_create(slug="machines", defaults={"name": "Кофемашины"})
    response = owner_client.patch(detail(products["cheap"]), changes, format="json")
    assert response.status_code == 400, response.json()
    assert field in response.json()["errors"]


def test_reserved_floor_rolls_back_all_product_fields(owner_client, products):
    product = products["cheap"]
    checkout(cart_with(product, 2))
    response = owner_client.patch(
        detail(product),
        {
            "stock_quantity": 1,
            "price": "1.00",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "stock_quantity" in response.json()["errors"]
    product.refresh_from_db()
    assert (product.stock_quantity, product.reserved_quantity, product.price) == (
        100,
        2,
        Decimal("500.00"),
    )
    assert not StockAdjustment.objects.exists()


def test_manage_rejects_category_outside_supported_contract(owner_client, products):
    category = Category.objects.create(slug="storage-probe", name="Diagnostic category")
    data = {**payload(), "category": category.slug, "attributes": {}}
    response = owner_client.post(reverse("manage-product-list"), data, format="json")
    assert response.status_code == 400
    assert "category" in response.json()["errors"]
    assert Product.objects.count() == 3


def test_demo_edit_requires_explicit_conversion_and_preserves_real_gallery(
    owner_client, products
):
    product = products["cheap"]
    Product.objects.filter(pk=product.pk).update(origin="demo", demo_source="fixture")
    mock = ProductImage.objects.create(
        product=product, image="mock.png", is_mock=True, is_main=True
    )
    photo = ProductImage.objects.create(product=product, image="owner.png", order=1)
    response = owner_client.patch(
        detail(product), {"name": "Owner edit"}, format="json"
    )
    assert response.status_code == 400 and "save_as_owner" in response.json()["errors"]
    converted = owner_client.patch(
        detail(product),
        {
            "save_as_owner": True,
            "name": "Owner edit",
            "stock_quantity": 8,
        },
        format="json",
    )
    assert converted.status_code == 200, converted.json()
    assert converted.json()["origin"] == "owner"
    assert converted.json()["demo_source"] == "fixture"
    assert converted.json()["has_uploaded_images"] is True
    public = APIClient().get(reverse("product-detail", args=[product.slug])).json()
    assert len(public["images"]) == 1 and public["images"][0]["is_mock"] is False
    assert public["image_url"].endswith("owner.png")
    assert set(product.images.values_list("pk", flat=True)) == {mock.pk, photo.pk}
    owner_client.post(reverse("manage-catalog-disable-demo"), {}, format="json")
    assert (
        APIClient().get(reverse("product-detail", args=[product.slug])).status_code
        == 200
    )


def test_cutover_persists_idempotently_without_modifying_owner_or_relations(
    owner_client, products, staff, settings, tmp_path
):
    settings.MEDIA_ROOT = tmp_path
    demo = products["cheap"]
    owner = products["pricey"]
    Product.objects.filter(pk=demo.pk).update(origin="demo", demo_source="fixture")
    favorite = Favorite.objects.create(user=staff, product=owner)
    order = checkout(cart_with(owner))
    demo_cart = cart_with(demo)
    before = Product.objects.filter(pk=owner.pk).values().get()
    state_url = reverse("manage-catalog-disable-demo")
    first = owner_client.post(state_url, {}, format="json")
    assert first.status_code == 200 and first.json()["demo_enabled"] is False
    assert owner_client.post(state_url, {}, format="json").json() == first.json()
    state = CatalogState.objects.get(pk=1)
    assert state.switched_at and state.switched_by_id == staff.pk
    assert (
        APIClient().get(reverse("product-detail", args=[demo.slug])).status_code == 404
    )
    assert (
        APIClient().get(reverse("product-detail", args=[owner.slug])).status_code == 200
    )
    assert demo.name not in str(APIClient().get(reverse("product-list")).json())
    assert owner_client.get(detail(demo)).json()["hidden_reason"] == "demo_disabled"
    assert owner_client.get(detail(owner)).json()["hidden_reason"] is None
    call_command("seed_catalog")
    assert Product.objects.count() == 3
    assert Product.objects.filter(pk=owner.pk).values().get() == before
    assert Favorite.objects.filter(pk=favorite.pk).exists()
    assert Order.objects.get(pk=order.pk).stock_lines.get().product_id == owner.pk
    response = APIClient().post(
        reverse("cart-item-create"),
        {"product_id": str(demo.pk), "quantity": 1},
        format="json",
    )
    assert response.status_code == 400
    with pytest.raises(InsufficientStock):
        checkout(demo_cart)


def test_non_object_write_body_returns_validation_error(owner_client, products):
    response = owner_client.patch(
        detail(products["cheap"]), [{"name": "invalid"}], format="json"
    )
    assert response.status_code == 400


def test_seed_classifies_only_created_records(
    owner_client, products, settings, tmp_path
):
    settings.MEDIA_ROOT = tmp_path
    call_command("seed_catalog")
    assert Product.objects.filter(origin="owner").count() == 3
    demos = Product.objects.filter(origin="demo")
    assert demos.count() == 18
    assert ProductImage.objects.filter(product__in=demos, is_mock=True).count() == 18
    product = demos.first()
    response = owner_client.patch(
        detail(product), {"save_as_owner": True}, format="json"
    )
    assert (
        response.status_code == 200 and response.json()["has_uploaded_images"] is False
    )
    assert (
        APIClient()
        .get(reverse("product-detail", args=[product.slug]))
        .json()["image_url"]
        is None
    )
    call_command("seed_catalog")
    product.refresh_from_db()
    assert product.origin == "owner"


def test_manage_list_filters_includes_unpublished_and_pagination(
    owner_client, products
):
    Product.objects.filter(pk=products["cheap"].pk).update(is_published=False)
    response = owner_client.get(
        reverse("manage-product-list"), {"is_published": "false", "page_size": 1}
    )
    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["results"][0]["id"] == str(products["cheap"].pk)


@pytest.mark.parametrize("endpoint", ["manage-product-list", "product-list"])
@pytest.mark.parametrize("field", ["price_min", "price_max"])
@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity"])
def test_nonfinite_price_filters_return_field_errors(
    owner_client, products, endpoint, field, value
):
    response = owner_client.get(reverse(endpoint), {field: value})
    assert response.status_code == 400
    assert field in response.json()["errors"]


@pytest.mark.django_db(transaction=True)
def test_manage_patch_races_checkout_without_lost_reservations(
    owner_client, products, staff
):
    product = products["cheap"]
    Product.objects.filter(pk=product.pk).update(stock_quantity=1)
    cart = cart_with(product)
    outcomes = race(
        lambda: checkout(cart),
        lambda: owner_client.patch(
            detail(product), {"stock_quantity": 0}, format="json"
        ),
    )
    product.refresh_from_db()
    assert (product.stock_quantity, product.reserved_quantity) in [(0, 0), (1, 1)]
    responses = [outcome for outcome in outcomes if hasattr(outcome, "status_code")]
    assert len(responses) == 1
    assert responses[0].status_code == (200 if product.stock_quantity == 0 else 400)
    assert StockAdjustment.objects.count() == (1 if product.stock_quantity == 0 else 0)


@pytest.mark.django_db(transaction=True)
def test_cutover_and_checkout_serialize_demo_reservation(products, staff):
    product = products["cheap"]
    Product.objects.filter(pk=product.pk).update(origin="demo", stock_quantity=1)
    product.refresh_from_db()
    cart = cart_with(product)
    outcomes = race(lambda: checkout(cart), lambda: disable_demo(actor=staff))
    product.refresh_from_db()
    assert CatalogState.objects.get(pk=1).demo_enabled is False
    assert product.reserved_quantity in (0, 1)
    assert (
        sum(isinstance(outcome, Order) for outcome in outcomes)
        == product.reserved_quantity
    )
    assert (
        sum(isinstance(outcome, InsufficientStock) for outcome in outcomes)
        == 1 - product.reserved_quantity
    )
    with pytest.raises(InsufficientStock):
        checkout(cart_with(product))


@pytest.mark.django_db(transaction=True)
def test_conversion_and_cutover_preserve_owner_product(owner_client, products, staff):
    product = products["cheap"]
    Product.objects.filter(pk=product.pk).update(origin="demo", demo_source="fixture")
    outcomes = race(
        lambda: disable_demo(actor=staff),
        lambda: owner_client.patch(
            detail(product),
            {
                "save_as_owner": True,
                "stock_quantity": 3,
                "name": "Kept owner product",
            },
            format="json",
        ),
    )
    response = next(outcome for outcome in outcomes if hasattr(outcome, "status_code"))
    assert response.status_code == 200, response.json()
    product.refresh_from_db()
    assert (product.origin, product.demo_source, product.stock_quantity) == (
        "owner",
        "fixture",
        3,
    )
    assert CatalogState.objects.get(pk=1).demo_enabled is False
    assert (
        APIClient().get(reverse("product-detail", args=[product.slug])).status_code
        == 200
    )

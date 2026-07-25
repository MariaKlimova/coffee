"""Cart API tests for COFFEE-31."""

from decimal import Decimal
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.cart.models import Cart, CartItem
from apps.cart.services import CART_TOKEN_HEADER
from apps.catalog.models import Category, Product
from tests.helpers import auth_client

User = get_user_model()


@pytest.fixture
def products(db) -> dict:
    coffee = Category.objects.create(name="Кофе", slug="coffee")
    cheap = Product.objects.create(
        name="Дешёвый кофе",
        slug="cheap-coffee",
        category=coffee,
        short_description="Бюджетный вариант",
        price=Decimal("500.00"),
    )
    pricey = Product.objects.create(
        name="Дорогой кофе",
        slug="pricey-coffee",
        category=coffee,
        short_description="Премиум зерно",
        price=Decimal("1500.00"),
    )
    unavailable = Product.objects.create(
        name="Нет в наличии",
        slug="out-of-stock",
        category=coffee,
        short_description="Временно недоступен",
        price=Decimal("900.00"),
        in_stock=False,
    )
    return {
        "coffee": coffee,
        "cheap": cheap,
        "pricey": pricey,
        "unavailable": unavailable,
    }


def _token_from(response) -> str:
    token = response.headers.get(CART_TOKEN_HEADER)
    assert token, "Expected X-Cart-Token response header"
    return token


@pytest.mark.django_db
def test_guest_creates_cart_without_token(
    api_client: APIClient,
    products: dict,
) -> None:
    product = products["cheap"]

    response = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(product.id), "quantity": 1},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    token = _token_from(response)
    body = response.json()
    assert body["quantity"] == 1
    assert body["product"]["id"] == str(product.id)
    assert body["line_total"] == "500.00"
    assert Cart.objects.filter(cart_token=token, user__isnull=True).exists()


@pytest.mark.django_db
def test_guest_reuses_same_cart_with_token(
    api_client: APIClient,
    products: dict,
) -> None:
    cheap = products["cheap"]
    pricey = products["pricey"]

    first = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(cheap.id), "quantity": 1},
        format="json",
    )
    token = _token_from(first)

    second = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(pricey.id), "quantity": 2},
        format="json",
        HTTP_X_CART_TOKEN=token,
    )
    assert second.status_code == status.HTTP_201_CREATED
    assert _token_from(second) == token

    detail = api_client.get(
        reverse("cart-detail"),
        HTTP_X_CART_TOKEN=token,
    )
    assert detail.status_code == status.HTTP_200_OK
    body = detail.json()
    assert body["items_count"] == 2
    assert body["cart_token"] == token
    assert body["total"] == "3500.00"
    assert Cart.objects.filter(cart_token=token).count() == 1


@pytest.mark.django_db
def test_add_same_product_increases_quantity(
    api_client: APIClient,
    products: dict,
) -> None:
    product = products["cheap"]

    first = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(product.id), "quantity": 1},
        format="json",
    )
    token = _token_from(first)
    item_id = first.json()["id"]

    second = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(product.id), "quantity": 2},
        format="json",
        HTTP_X_CART_TOKEN=token,
    )
    assert second.status_code == status.HTTP_201_CREATED
    assert second.json()["id"] == item_id
    assert second.json()["quantity"] == 3
    assert second.json()["line_total"] == "1500.00"
    assert CartItem.objects.filter(product=product).count() == 1


@pytest.mark.django_db
def test_patch_and_delete_cart_item(
    api_client: APIClient,
    products: dict,
) -> None:
    product = products["cheap"]
    created = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(product.id), "quantity": 1},
        format="json",
    )
    token = _token_from(created)
    item_id = created.json()["id"]

    patched = api_client.patch(
        reverse("cart-item-detail", kwargs={"id": item_id}),
        {"quantity": 5},
        format="json",
        HTTP_X_CART_TOKEN=token,
    )
    assert patched.status_code == status.HTTP_200_OK
    assert patched.json()["quantity"] == 5
    assert patched.json()["line_total"] == "2500.00"

    zero = api_client.patch(
        reverse("cart-item-detail", kwargs={"id": item_id}),
        {"quantity": 0},
        format="json",
        HTTP_X_CART_TOKEN=token,
    )
    assert zero.status_code == status.HTTP_400_BAD_REQUEST
    assert zero.json()["code"] == "validation_error"

    deleted = api_client.delete(
        reverse("cart-item-detail", kwargs={"id": item_id}),
        HTTP_X_CART_TOKEN=token,
    )
    assert deleted.status_code == status.HTTP_204_NO_CONTENT
    assert not CartItem.objects.filter(pk=item_id).exists()


@pytest.mark.django_db
def test_cannot_add_unavailable_product(
    api_client: APIClient,
    products: dict,
) -> None:
    product = products["unavailable"]

    response = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(product.id), "quantity": 1},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    body = response.json()
    assert body["code"] == "validation_error"
    assert "product_id" in body["errors"]
    assert CartItem.objects.count() == 0


@pytest.mark.django_db
def test_authenticated_user_cart_without_token(
    api_client: APIClient,
    user: User,
    products: dict,
) -> None:
    auth_client(api_client, user)
    product = products["cheap"]

    response = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(product.id), "quantity": 2},
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert CART_TOKEN_HEADER not in response.headers

    detail = api_client.get(reverse("cart-detail"))
    assert detail.status_code == status.HTTP_200_OK
    body = detail.json()
    assert body["items_count"] == 1
    assert body["cart_token"] is None
    assert body["total"] == "1000.00"
    assert Cart.objects.filter(user=user, cart_token__isnull=True).count() == 1


@pytest.mark.django_db
def test_merge_sums_overlapping_products(
    api_client: APIClient,
    user: User,
    products: dict,
) -> None:
    cheap = products["cheap"]
    pricey = products["pricey"]

    guest_add = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(cheap.id), "quantity": 2},
        format="json",
    )
    token = _token_from(guest_add)
    api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(pricey.id), "quantity": 1},
        format="json",
        HTTP_X_CART_TOKEN=token,
    )

    auth_client(api_client, user)
    api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(cheap.id), "quantity": 3},
        format="json",
    )

    merged = api_client.post(
        reverse("cart-merge"),
        {"cart_token": token},
        format="json",
    )
    assert merged.status_code == status.HTTP_200_OK
    body = merged.json()
    assert body["items_count"] == 2
    assert body["cart_token"] is None

    by_product = {item["product"]["id"]: item["quantity"] for item in body["items"]}
    assert by_product[str(cheap.id)] == 5
    assert by_product[str(pricey.id)] == 1
    assert body["total"] == "4000.00"

    assert not Cart.objects.filter(cart_token=token).exists()
    assert CartItem.objects.filter(cart__user=user).count() == 2


@pytest.mark.django_db
def test_merge_requires_auth(api_client: APIClient) -> None:
    response = api_client.post(
        reverse("cart-merge"),
        {"cart_token": str(uuid4())},
        format="json",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_item_isolation_between_carts(
    api_client: APIClient,
    products: dict,
) -> None:
    product = products["cheap"]

    first = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(product.id), "quantity": 1},
        format="json",
    )
    token_a = _token_from(first)
    item_id = first.json()["id"]

    second = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(product.id), "quantity": 1},
        format="json",
    )
    token_b = _token_from(second)
    assert token_a != token_b

    response = api_client.patch(
        reverse("cart-item-detail", kwargs={"id": item_id}),
        {"quantity": 9},
        format="json",
        HTTP_X_CART_TOKEN=token_b,
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_stale_cart_token_creates_new_guest_cart(
    api_client: APIClient,
    products: dict,
) -> None:
    stale = str(uuid4())
    response = api_client.get(
        reverse("cart-detail"),
        HTTP_X_CART_TOKEN=stale,
    )
    assert response.status_code == status.HTTP_200_OK
    new_token = _token_from(response)
    assert new_token != stale
    assert response.json()["cart_token"] == new_token
    assert Cart.objects.filter(cart_token=new_token).exists()
    assert not Cart.objects.filter(cart_token=stale).exists()


@pytest.mark.django_db
def test_merge_skips_out_of_stock_guest_items(
    api_client: APIClient,
    user: User,
    products: dict,
) -> None:
    cheap = products["cheap"]
    unavailable = products["unavailable"]

    guest_add = api_client.post(
        reverse("cart-item-create"),
        {"product_id": str(cheap.id), "quantity": 1},
        format="json",
    )
    token = _token_from(guest_add)
    guest = Cart.objects.get(cart_token=token)
    CartItem.objects.create(cart=guest, product=unavailable, quantity=2)

    auth_client(api_client, user)
    merged = api_client.post(
        reverse("cart-merge"),
        {"cart_token": token},
        format="json",
    )
    assert merged.status_code == status.HTTP_200_OK
    body = merged.json()
    assert body["items_count"] == 1
    assert body["items"][0]["product"]["id"] == str(cheap.id)
    assert not CartItem.objects.filter(
        cart__user=user,
        product=unavailable,
    ).exists()
    assert not Cart.objects.filter(cart_token=token).exists()

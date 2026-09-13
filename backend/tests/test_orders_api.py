"""Orders API tests for COFFEE-35."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.cart.models import Cart, CartItem
from apps.catalog.models import Product
from apps.orders.models import Order, OrderItem
from tests.helpers import auth_client

User = get_user_model()


def _add_to_cart(
    client: APIClient,
    product: Product,
    quantity: int = 1,
    *,
    token: str | None = None,
) -> str | None:
    kwargs = {}
    if token is not None:
        kwargs["HTTP_X_CART_TOKEN"] = token
    response = client.post(
        reverse("cart-item-create"),
        {"product_id": str(product.id), "quantity": quantity},
        format="json",
        **kwargs,
    )
    assert response.status_code == status.HTTP_201_CREATED
    return response.headers.get("X-Cart-Token")


@pytest.mark.django_db
def test_auth_user_creates_order_from_cart(
    api_client: APIClient,
    user,
    products: dict,
) -> None:
    auth_client(api_client, user)
    cheap = products["cheap"]
    pricey = products["pricey"]
    _add_to_cart(api_client, cheap, 2)
    _add_to_cart(api_client, pricey, 1)

    response = api_client.post(
        reverse("order-list-create"),
        {"delivery_address": "Москва, ул. Кофейная, 1"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["status"] == "pending"
    assert body["total"] == "2500.00"
    assert body["delivery_address"] == "Москва, ул. Кофейная, 1"
    assert len(body["items"]) == 2
    names = {item["product_name"] for item in body["items"]}
    assert names == {"Дешёвый кофе", "Дорогой кофе"}
    prices = {item["product_name"]: item["product_price"] for item in body["items"]}
    assert prices["Дешёвый кофе"] == "500.00"
    assert prices["Дорогой кофе"] == "1500.00"

    order = Order.objects.get(pk=body["id"])
    assert order.user_id == user.id
    assert order.guest_email is None
    assert CartItem.objects.filter(cart__user=user).count() == 0


@pytest.mark.django_db
def test_guest_creates_order_from_cart(
    api_client: APIClient,
    products: dict,
) -> None:
    cheap = products["cheap"]
    token = _add_to_cart(api_client, cheap, 1)
    assert token

    response = api_client.post(
        reverse("order-list-create"),
        {
            "delivery_address": "СПб, Невский, 10",
            "guest_email": "guest@example.com",
            "guest_phone": "+79001234567",
        },
        format="json",
        HTTP_X_CART_TOKEN=token,
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["status"] == "pending"
    assert body["total"] == "500.00"
    assert body["guest_email"] == "guest@example.com"
    assert body["guest_phone"] == "+79001234567"
    assert len(body["items"]) == 1

    order = Order.objects.get(pk=body["id"])
    assert order.user_id is None
    assert CartItem.objects.filter(cart__cart_token=token).count() == 0
    assert Cart.objects.filter(cart_token=token).exists()


@pytest.mark.django_db
def test_empty_cart_returns_400(
    api_client: APIClient,
    user,
) -> None:
    auth_client(api_client, user)

    response = api_client.post(
        reverse("order-list-create"),
        {"delivery_address": "Москва"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert Order.objects.count() == 0
    body = response.json()
    assert body["code"] == "validation_error"
    assert "empty" in str(body["errors"]).lower() or "empty" in body["detail"].lower()


@pytest.mark.django_db
def test_unavailable_product_blocks_order(
    api_client: APIClient,
    user,
    products: dict,
) -> None:
    auth_client(api_client, user)
    cheap = products["cheap"]
    unavailable = products["unavailable"]
    _add_to_cart(api_client, cheap, 1)

    cart = Cart.objects.get(user=user)
    CartItem.objects.create(cart=cart, product=unavailable, quantity=1)

    response = api_client.post(
        reverse("order-list-create"),
        {"delivery_address": "Москва"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert Order.objects.count() == 0
    body = response.json()
    assert "Нет в наличии" in str(body)
    assert CartItem.objects.filter(cart=cart).count() == 2


@pytest.mark.django_db
def test_order_item_price_snapshot_survives_product_price_change(
    api_client: APIClient,
    user,
    products: dict,
) -> None:
    auth_client(api_client, user)
    cheap = products["cheap"]
    _add_to_cart(api_client, cheap, 1)

    response = api_client.post(
        reverse("order-list-create"),
        {"delivery_address": "Москва"},
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    order_id = response.json()["id"]

    cheap.price = Decimal("999.00")
    cheap.save(update_fields=["price"])

    item = OrderItem.objects.get(order_id=order_id)
    assert item.product_price == Decimal("500.00")

    detail = api_client.get(reverse("order-detail", kwargs={"id": order_id}))
    assert detail.status_code == status.HTTP_200_OK
    assert detail.json()["items"][0]["product_price"] == "500.00"
    assert detail.json()["total"] == "500.00"


@pytest.mark.django_db
def test_user_cannot_access_another_users_order(
    api_client: APIClient,
    user,
    products: dict,
) -> None:
    auth_client(api_client, user)
    _add_to_cart(api_client, products["cheap"], 1)
    created = api_client.post(
        reverse("order-list-create"),
        {"delivery_address": "Москва"},
        format="json",
    )
    order_id = created.json()["id"]

    other = User.objects.create_user(
        email="bob@example.com",
        password="SecurePass1",
    )
    auth_client(api_client, other)

    response = api_client.get(reverse("order-detail", kwargs={"id": order_id}))
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_guest_can_fetch_guest_order_by_id(
    api_client: APIClient,
    products: dict,
) -> None:
    token = _add_to_cart(api_client, products["cheap"], 1)
    created = api_client.post(
        reverse("order-list-create"),
        {
            "delivery_address": "СПб",
            "guest_email": "guest@example.com",
            "guest_phone": "+79001234567",
        },
        format="json",
        HTTP_X_CART_TOKEN=token,
    )
    assert created.status_code == status.HTTP_201_CREATED
    order_id = created.json()["id"]

    # Fresh client without auth / cart token — confirmation by UUID.
    anonymous = APIClient()
    detail = anonymous.get(reverse("order-detail", kwargs={"id": order_id}))
    assert detail.status_code == status.HTTP_200_OK
    assert detail.json()["guest_email"] == "guest@example.com"
    assert detail.json()["total"] == "500.00"


@pytest.mark.django_db
def test_anonymous_cannot_fetch_user_owned_order(
    api_client: APIClient,
    user,
    products: dict,
) -> None:
    auth_client(api_client, user)
    _add_to_cart(api_client, products["cheap"], 1)
    created = api_client.post(
        reverse("order-list-create"),
        {"delivery_address": "Москва"},
        format="json",
    )
    order_id = created.json()["id"]

    anonymous = APIClient()
    detail = anonymous.get(reverse("order-detail", kwargs={"id": order_id}))
    assert detail.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_guest_checkout_requires_email_and_phone(
    api_client: APIClient,
    products: dict,
) -> None:
    token = _add_to_cart(api_client, products["cheap"], 1)

    response = api_client.post(
        reverse("order-list-create"),
        {"delivery_address": "Москва"},
        format="json",
        HTTP_X_CART_TOKEN=token,
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert Order.objects.count() == 0
    errors = response.json()["errors"]
    assert "guest_email" in errors
    assert "guest_phone" in errors


@pytest.mark.django_db
def test_list_orders_requires_auth(api_client: APIClient) -> None:
    response = api_client.get(reverse("order-list-create"))
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_list_orders_returns_only_current_user(
    api_client: APIClient,
    user,
    products: dict,
) -> None:
    auth_client(api_client, user)
    _add_to_cart(api_client, products["cheap"], 1)
    mine = api_client.post(
        reverse("order-list-create"),
        {"delivery_address": "Москва"},
        format="json",
    )
    assert mine.status_code == status.HTTP_201_CREATED

    other = User.objects.create_user(
        email="bob@example.com",
        password="SecurePass1",
    )
    auth_client(api_client, other)
    _add_to_cart(api_client, products["pricey"], 1)
    theirs = api_client.post(
        reverse("order-list-create"),
        {"delivery_address": "СПб"},
        format="json",
    )
    assert theirs.status_code == status.HTTP_201_CREATED

    auth_client(api_client, user)
    listed = api_client.get(reverse("order-list-create"))
    assert listed.status_code == status.HTTP_200_OK
    body = listed.json()
    assert body["count"] == 1
    assert body["results"][0]["id"] == mine.json()["id"]

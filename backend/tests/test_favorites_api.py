"""Favorites API tests for COFFEE-27."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.catalog.models import Category, Product
from apps.favorites.models import Favorite
from tests.helpers import auth_client

User = get_user_model()


@pytest.fixture
def other_user(db) -> User:
    return User.objects.create_user(
        email="bob@example.com",
        password="SecurePass1",
    )


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
    return {"coffee": coffee, "cheap": cheap, "pricey": pricey}


@pytest.mark.django_db
def test_add_favorite(
    api_client: APIClient,
    user: User,
    products: dict,
) -> None:
    auth_client(api_client, user)
    product = products["cheap"]

    response = api_client.post(
        reverse("favorite-list"),
        {"product_id": str(product.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["product_id"] == str(product.id)
    assert "created_at" in body
    assert Favorite.objects.filter(user=user, product=product).count() == 1


@pytest.mark.django_db
def test_add_favorite_idempotent(
    api_client: APIClient,
    user: User,
    products: dict,
) -> None:
    auth_client(api_client, user)
    product = products["cheap"]

    first = api_client.post(
        reverse("favorite-list"),
        {"product_id": str(product.id)},
        format="json",
    )
    second = api_client.post(
        reverse("favorite-list"),
        {"product_id": str(product.id)},
        format="json",
    )

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_201_CREATED
    assert Favorite.objects.filter(user=user, product=product).count() == 1


@pytest.mark.django_db
def test_add_favorite_unknown_product(
    api_client: APIClient,
    user: User,
    products: dict,
) -> None:
    auth_client(api_client, user)
    missing_id = "00000000-0000-0000-0000-000000000001"

    response = api_client.post(
        reverse("favorite-list"),
        {"product_id": missing_id},
        format="json",
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    body = response.json()
    assert body["code"] == "not_found"
    assert "detail" in body


@pytest.mark.django_db
def test_add_favorite_invalid_product_id(
    api_client: APIClient,
    user: User,
    db,
) -> None:
    auth_client(api_client, user)

    response = api_client.post(
        reverse("favorite-list"),
        {"product_id": "not-a-uuid"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    body = response.json()
    assert body["code"] == "validation_error"


@pytest.mark.django_db
def test_list_favorites_only_own(
    api_client: APIClient,
    user: User,
    other_user: User,
    products: dict,
) -> None:
    Favorite.objects.create(user=user, product=products["cheap"])
    Favorite.objects.create(user=other_user, product=products["pricey"])

    auth_client(api_client, user)
    response = api_client.get(reverse("favorite-list"))

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["count"] == 1
    assert len(body["results"]) == 1
    assert body["results"][0]["id"] == str(products["cheap"].id)
    assert body["results"][0]["is_favorite"] is True


@pytest.mark.django_db
def test_delete_favorite(
    api_client: APIClient,
    user: User,
    products: dict,
) -> None:
    product = products["cheap"]
    Favorite.objects.create(user=user, product=product)
    auth_client(api_client, user)

    response = api_client.delete(
        reverse("favorite-detail", kwargs={"product_id": product.id}),
    )

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert not Favorite.objects.filter(user=user, product=product).exists()


@pytest.mark.django_db
def test_delete_favorite_missing_returns_404(
    api_client: APIClient,
    user: User,
    products: dict,
) -> None:
    auth_client(api_client, user)
    product = products["cheap"]

    response = api_client.delete(
        reverse("favorite-detail", kwargs={"product_id": product.id}),
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    body = response.json()
    assert body["code"] == "not_found"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "method,url_name,kwargs,data",
    [
        ("get", "favorite-list", {}, None),
        (
            "post",
            "favorite-list",
            {},
            {"product_id": "00000000-0000-0000-0000-000000000001"},
        ),
        (
            "delete",
            "favorite-detail",
            {"product_id": "00000000-0000-0000-0000-000000000001"},
            None,
        ),
    ],
)
def test_favorites_require_auth(
    api_client: APIClient,
    method: str,
    url_name: str,
    kwargs: dict,
    data: dict | None,
    db,
) -> None:
    url = reverse(url_name, kwargs=kwargs)
    if method == "get":
        response = api_client.get(url)
    elif method == "post":
        response = api_client.post(url, data, format="json")
    else:
        response = api_client.delete(url)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    body = response.json()
    assert "detail" in body
    assert "code" in body


@pytest.mark.django_db
def test_catalog_is_favorite_for_authenticated(
    api_client: APIClient,
    user: User,
    products: dict,
) -> None:
    Favorite.objects.create(user=user, product=products["cheap"])
    auth_client(api_client, user)

    list_response = api_client.get(reverse("product-list"))
    assert list_response.status_code == status.HTTP_200_OK
    by_id = {item["id"]: item for item in list_response.json()["results"]}
    assert by_id[str(products["cheap"].id)]["is_favorite"] is True
    assert by_id[str(products["pricey"].id)]["is_favorite"] is False

    detail = api_client.get(
        reverse("product-detail", kwargs={"slug": products["cheap"].slug}),
    )
    assert detail.status_code == status.HTTP_200_OK
    assert detail.json()["is_favorite"] is True

    related = api_client.get(
        reverse("product-related", kwargs={"slug": products["pricey"].slug}),
    )
    assert related.status_code == status.HTTP_200_OK
    related_by_id = {item["id"]: item for item in related.json()}
    assert related_by_id[str(products["cheap"].id)]["is_favorite"] is True


@pytest.mark.django_db
def test_catalog_is_favorite_false_for_guest(
    api_client: APIClient,
    user: User,
    products: dict,
) -> None:
    Favorite.objects.create(user=user, product=products["cheap"])

    response = api_client.get(reverse("product-list"))

    assert response.status_code == status.HTTP_200_OK
    for item in response.json()["results"]:
        assert item["is_favorite"] is False

"""Catalog API tests for COFFEE-20."""

from decimal import Decimal
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.catalog.models import Category, Product, ProductImage


def _png(name: str = "p.png") -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new("RGB", (16, 16), color=(120, 80, 40)).save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


@pytest.fixture
def catalog_data(db) -> dict:
    coffee = Category.objects.create(name="Кофе", slug="coffee")
    machines = Category.objects.create(name="Кофемашины", slug="machines")

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
        old_price=Decimal("1800.00"),
        attributes={"country": "Эфиопия", "intensity": 8, "roast": 2},
    )
    machine = Product.objects.create(
        name="Рожковая машина",
        slug="portafilter-machine",
        category=machines,
        short_description="15 бар для дома",
        price=Decimal("20000.00"),
        attributes={"pressure_bar": 15, "power_w": 1400, "dimensions": "30×30×40"},
    )
    out_of_stock = Product.objects.create(
        name="Нет в наличии",
        slug="out-of-stock-coffee",
        category=coffee,
        short_description="Временно закончился",
        price=Decimal("640.00"),
        in_stock=False,
    )
    ProductImage.objects.create(
        product=cheap,
        image=_png("cheap.png"),
        order=0,
        is_main=True,
    )
    ProductImage.objects.create(
        product=pricey,
        image=_png("pricey.png"),
        order=0,
        is_main=True,
    )
    ProductImage.objects.create(
        product=machine,
        image=_png("machine.png"),
        order=0,
        is_main=True,
    )
    ProductImage.objects.create(
        product=out_of_stock,
        image=_png("oos.png"),
        order=0,
        is_main=True,
    )
    return {
        "coffee": coffee,
        "machines": machines,
        "cheap": cheap,
        "pricey": pricey,
        "machine": machine,
        "out_of_stock": out_of_stock,
    }


@pytest.mark.django_db
def test_list_products_returns_items(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(reverse("product-list"))

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["count"] == 4
    assert len(body["results"]) == 4
    first = body["results"][0]
    assert "short_description" in first
    assert "image_url" in first
    assert isinstance(first["price"], str)


@pytest.mark.django_db
def test_filter_by_category(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(reverse("product-list"), {"category": "coffee"})

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["count"] == 3
    assert {item["category"] for item in body["results"]} == {"coffee"}


@pytest.mark.django_db
def test_filter_by_price_range(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(
        reverse("product-list"),
        {"price_min": "1000.00", "price_max": "1600.00"},
    )

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["count"] == 1
    assert body["results"][0]["slug"] == "pricey-coffee"


@pytest.mark.django_db
def test_ordering_by_price_asc(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(reverse("product-list"), {"ordering": "price"})

    assert response.status_code == status.HTTP_200_OK
    prices = [Decimal(item["price"]) for item in response.json()["results"]]
    assert prices == sorted(prices)


@pytest.mark.django_db
def test_product_detail_by_slug(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(
        reverse("product-detail", kwargs={"slug": "pricey-coffee"}),
    )

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["slug"] == "pricey-coffee"
    assert body["attributes"]["country"] == "Эфиопия"
    assert len(body["images"]) == 1
    assert body["images"][0]["is_main"] is True


@pytest.mark.django_db
def test_product_detail_unknown_slug_404(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(
        reverse("product-detail", kwargs={"slug": "missing"}),
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_related_products_same_category_excludes_self(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    from apps.catalog.views import RELATED_PRODUCTS_LIMIT

    response = api_client.get(
        reverse("product-related", kwargs={"slug": "pricey-coffee"}),
    )

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert isinstance(body, list)
    assert len(body) <= RELATED_PRODUCTS_LIMIT
    slugs = {item["slug"] for item in body}
    assert "pricey-coffee" not in slugs
    assert "portafilter-machine" not in slugs
    assert {item["category"] for item in body} == {"coffee"}
    assert slugs == {"cheap-coffee", "out-of-stock-coffee"}


@pytest.mark.django_db
def test_related_products_empty_when_alone_in_category(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(
        reverse("product-related", kwargs={"slug": "portafilter-machine"}),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


@pytest.mark.django_db
def test_related_products_unknown_slug_404(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(
        reverse("product-related", kwargs={"slug": "missing"}),
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_related_products_respects_limit(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    from apps.catalog.views import RELATED_PRODUCTS_LIMIT

    coffee = catalog_data["coffee"]
    for index in range(RELATED_PRODUCTS_LIMIT + 2):
        product = Product.objects.create(
            name=f"Сосед {index}",
            slug=f"neighbor-coffee-{index}",
            category=coffee,
            short_description="Сосед по категории",
            price=Decimal("800.00") + index,
        )
        ProductImage.objects.create(
            product=product,
            image=_png(f"neighbor-{index}.png"),
            order=0,
            is_main=True,
        )

    response = api_client.get(
        reverse("product-related", kwargs={"slug": "pricey-coffee"}),
    )

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert len(body) == RELATED_PRODUCTS_LIMIT
    assert all(item["slug"] != "pricey-coffee" for item in body)
    assert all(item["category"] == "coffee" for item in body)


@pytest.mark.django_db
def test_list_categories(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(reverse("category-list"))

    assert response.status_code == status.HTTP_200_OK
    slugs = {item["slug"] for item in response.json()}
    assert slugs == {"coffee", "machines"}


@pytest.mark.django_db
def test_product_list_has_no_n_plus_one(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    """List endpoint query count stays flat when more products are added."""
    coffee = catalog_data["coffee"]
    for index in range(5):
        product = Product.objects.create(
            name=f"Ещё кофе {index}",
            slug=f"extra-coffee-{index}",
            category=coffee,
            short_description="Ещё один товар",
            price=Decimal("700.00") + index,
        )
        ProductImage.objects.create(
            product=product,
            image=_png(f"extra-{index}.png"),
            order=0,
            is_main=True,
        )

    with CaptureQueriesContext(connection) as baseline:
        first = api_client.get(reverse("product-list"))
    assert first.status_code == status.HTTP_200_OK
    baseline_count = len(baseline)

    for index in range(5, 10):
        product = Product.objects.create(
            name=f"Ещё кофе {index}",
            slug=f"extra-coffee-{index}",
            category=coffee,
            short_description="Ещё один товар",
            price=Decimal("700.00") + index,
        )
        ProductImage.objects.create(
            product=product,
            image=_png(f"extra-{index}.png"),
            order=0,
            is_main=True,
        )

    with CaptureQueriesContext(connection) as again:
        second = api_client.get(reverse("product-list"))
    assert second.status_code == status.HTTP_200_OK
    # Constant number of queries relative to product count (no N+1).
    assert len(again) == baseline_count
    assert len(again) <= 5


@pytest.mark.django_db
def test_filter_by_in_stock(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(reverse("product-list"), {"in_stock": "true"})

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["count"] == 3
    assert all(item["in_stock"] is True for item in body["results"])


@pytest.mark.django_db
def test_search_by_name(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(reverse("product-list"), {"search": "Дорогой"})

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["count"] == 1
    assert body["results"][0]["slug"] == "pricey-coffee"


@pytest.mark.django_db
def test_detail_ignores_list_query_params(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    """Stray list filters must not turn an existing product into 404."""
    response = api_client.get(
        reverse("product-detail", kwargs={"slug": "pricey-coffee"}),
        {
            "category": "machines",
            "in_stock": "false",
            "search": "нет-такого",
            "price_min": "99999",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["slug"] == "pricey-coffee"


@pytest.mark.django_db
def test_invalid_query_params_return_400(
    api_client: APIClient,
    catalog_data: dict,
) -> None:
    response = api_client.get(
        reverse("product-list"),
        {"ordering": "name", "in_stock": "maybe", "price_min": "abc"},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    body = response.json()
    assert body["code"] == "validation_error"
    assert "ordering" in body["errors"] or "in_stock" in body["errors"]


@pytest.mark.django_db
def test_seed_catalog_command(db) -> None:
    from django.core.management import call_command

    call_command("seed_catalog")
    assert Category.objects.filter(slug__in=["coffee", "machines"]).count() == 2
    assert Product.objects.filter(category__slug="coffee").count() == 9
    assert Product.objects.filter(category__slug="machines").count() == 9
    assert ProductImage.objects.count() == 18

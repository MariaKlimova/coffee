"""Shared pytest fixtures for backend API tests."""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.catalog.models import Category, Product

User = get_user_model()


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user(db) -> User:
    return User.objects.create_user(
        email="alice@example.com",
        password="SecurePass1",
        first_name="Alice",
        last_name="Coffee",
    )


@pytest.fixture
def products(db) -> dict:
    """Shared catalog products for cart / favorites / orders API tests."""
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

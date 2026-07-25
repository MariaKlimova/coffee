"""Shared pytest fixtures for backend API tests."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

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

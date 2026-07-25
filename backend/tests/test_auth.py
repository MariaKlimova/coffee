"""Auth endpoint tests for COFFEE-15."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

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


def test_register_success(api_client: APIClient, db) -> None:
    """Successful registration returns tokens and hashes the password."""
    response = api_client.post(
        reverse("auth-register"),
        {
            "email": "new@example.com",
            "password": "SecurePass1",
            "password_confirm": "SecurePass1",
            "first_name": "New",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert "access" in body
    assert "refresh" in body
    assert body["user"]["email"] == "new@example.com"
    assert body["user"]["first_name"] == "New"

    created = User.objects.get(email="new@example.com")
    assert created.check_password("SecurePass1")
    assert created.password != "SecurePass1"


def test_register_duplicate_email(api_client: APIClient, user: User) -> None:
    """Registering with an existing email returns validation_error."""
    response = api_client.post(
        reverse("auth-register"),
        {
            "email": user.email,
            "password": "SecurePass1",
            "password_confirm": "SecurePass1",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    body = response.json()
    assert body["code"] == "validation_error"
    assert "email" in body["errors"]


def test_login_wrong_password(api_client: APIClient, user: User) -> None:
    """Login with a wrong password returns 401."""
    response = api_client.post(
        reverse("auth-login"),
        {"email": user.email, "password": "WrongPass1"},
        format="json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    body = response.json()
    assert body["code"] == "authentication_failed"
    assert "detail" in body


def test_me_requires_auth(api_client: APIClient, db) -> None:
    """GET /me/ without a token returns 401."""
    response = api_client.get(reverse("auth-me"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    body = response.json()
    assert "detail" in body
    assert "code" in body


def test_me_with_token(api_client: APIClient, user: User) -> None:
    """GET /me/ with a valid access token returns the user profile."""
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    response = api_client.get(reverse("auth-me"))

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["email"] == user.email
    assert body["id"] == str(user.id)
    assert "first_name" in body
    assert "last_name" in body


def test_refresh_token(api_client: APIClient, user: User) -> None:
    """Valid refresh token returns a new access token."""
    refresh = RefreshToken.for_user(user)

    response = api_client.post(
        reverse("auth-refresh"),
        {"refresh": str(refresh)},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert "access" in body


def test_logout_blacklists_refresh(api_client: APIClient, user: User) -> None:
    """Logout blacklists refresh so a subsequent refresh fails."""
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    logout_response = api_client.post(
        reverse("auth-logout"),
        {"refresh": str(refresh)},
        format="json",
    )
    assert logout_response.status_code == status.HTTP_204_NO_CONTENT

    refresh_response = api_client.post(
        reverse("auth-refresh"),
        {"refresh": str(refresh)},
        format="json",
    )
    assert refresh_response.status_code == status.HTTP_401_UNAUTHORIZED


def test_logout_requires_refresh(api_client: APIClient, user: User) -> None:
    """Logout without refresh returns validation_error 400."""
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    response = api_client.post(reverse("auth-logout"), {}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    body = response.json()
    assert body["code"] == "validation_error"
    assert "refresh" in body["errors"]

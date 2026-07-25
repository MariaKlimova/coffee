"""Shared helpers for backend API tests."""

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


def auth_client(client: APIClient, account: User) -> None:
    """Attach a Bearer access token for ``account`` to the API client."""
    refresh = RefreshToken.for_user(account)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

"""Custom user model: email login, UUID primary key."""

import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.users.managers import UserManager


class User(AbstractUser):
    """
    Store customer accounts keyed by email.

    AbstractUser already gives us password hashing, permissions, and
    is_staff/is_superuser — we only replace username with email.

    `created_at` is the product timestamp (COFFEE-15). AbstractUser still
    has `date_joined` for Django internals; prefer `created_at` in app code.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField("email address", unique=True)
    phone = models.CharField(max_length=32, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.email

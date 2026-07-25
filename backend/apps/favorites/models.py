"""Favorite: authenticated user's saved products."""

from django.conf import settings
from django.db import models


class Favorite(models.Model):
    """
    Many-to-many link between a user and a product with a created timestamp.

    Uniqueness of (user, product) is enforced at the database level so the
    same product cannot appear twice in one user's favorites.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorites",
    )
    product = models.ForeignKey(
        "catalog.Product",
        on_delete=models.CASCADE,
        related_name="favorites",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "favorite"
        verbose_name_plural = "favorites"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "product"],
                name="favorites_favorite_user_product_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} → {self.product_id}"

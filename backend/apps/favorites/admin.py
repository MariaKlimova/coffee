"""Django admin for favorites (optional ops visibility)."""

from django.contrib import admin

from apps.favorites.models import Favorite


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    """Browse favorites by user and product."""

    list_display = ("user", "product", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__email", "product__name", "product__slug")
    readonly_fields = ("created_at",)

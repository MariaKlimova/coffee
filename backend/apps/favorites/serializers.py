"""Favorites API serializers."""

from rest_framework import serializers

from apps.favorites.models import Favorite


class FavoriteSerializer(serializers.ModelSerializer):
    """Payload returned after adding a product to favorites."""

    class Meta:
        model = Favorite
        fields = ("product_id", "created_at")
        read_only_fields = fields


class FavoriteCreateSerializer(serializers.Serializer):
    """Request body for POST /api/favorites/."""

    product_id = serializers.UUIDField()

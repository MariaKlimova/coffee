"""Catalog API serializers (list/detail/category)."""

from decimal import Decimal

from django.db.models.fields.files import FieldFile
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.request import Request

from apps.catalog.models import Category, Product, ProductImage


def absolute_media_url(
    request: Request | None,
    file_field: FieldFile | None,
) -> str | None:
    """Build an absolute URL for an uploaded media file, if present."""
    if not file_field:
        return None
    url = file_field.url
    if request is None:
        return url
    return request.build_absolute_uri(url)


@extend_schema_field(str)
class MoneyField(serializers.Field):
    """Serialize Decimal prices as RUB decimal strings (OpenAPI Money)."""

    def to_representation(self, value: Decimal | None) -> str | None:
        if value is None:
            return None
        return f"{value:.2f}"


class CategorySerializer(serializers.ModelSerializer):
    """Public category payload for navigation."""

    class Meta:
        model = Category
        fields = ("id", "slug", "name")
        read_only_fields = fields


class ProductImageSerializer(serializers.ModelSerializer):
    """Single gallery image on the product detail page."""

    url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ("url", "order", "is_main", "is_mock")
        read_only_fields = fields

    def get_url(self, obj: ProductImage) -> str | None:
        return absolute_media_url(self.context.get("request"), obj.image)


class ProductListSerializer(serializers.ModelSerializer):
    """Lightweight product row for catalog grids."""

    available_quantity = serializers.IntegerField(read_only=True)
    in_stock = serializers.BooleanField(read_only=True)
    price = MoneyField()
    old_price = MoneyField(allow_null=True)
    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    image_url = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()
    has_uploaded_images = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "slug",
            "short_description",
            "price",
            "old_price",
            "category",
            "in_stock",
            "available_quantity",
            "image_url",
            "is_favorite",
            "origin",
            "has_uploaded_images",
        )
        read_only_fields = fields

    def get_image_url(self, obj: Product) -> str | None:
        images = self.product_images(obj)
        main = next((img for img in images if img.is_main), None)
        chosen = main or (images[0] if images else None)
        if chosen is None:
            return None
        return absolute_media_url(self.context.get("request"), chosen.image)

    def product_images(self, obj):
        return [
            image
            for image in obj.images.all()
            if not image.is_mock
            or obj.origin == Product.Origin.DEMO
            or self.context.get("include_mock_images", False)
        ]

    def get_has_uploaded_images(self, obj) -> bool:
        return any(not image.is_mock for image in obj.images.all())

    def get_is_favorite(self, obj: Product) -> bool:
        if not hasattr(obj, "is_favorite"):
            return False
        return bool(obj.is_favorite)


class ProductDetailSerializer(ProductListSerializer):
    """Full product payload for the product page."""

    images = serializers.SerializerMethodField()

    @extend_schema_field(ProductImageSerializer(many=True))
    def get_images(self, obj):
        return ProductImageSerializer(
            self.product_images(obj), many=True, context=self.context
        ).data

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + (
            "description",
            "attributes",
            "images",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

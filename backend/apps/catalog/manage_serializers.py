"""Owner catalog contract; inventory counters and provenance are server-owned."""

from collections.abc import Mapping

from django.core.exceptions import ValidationError as ModelValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.catalog.attributes import ATTRIBUTES_BY_CATEGORY_SLUG
from apps.catalog.models import CatalogState, Category, Product
from apps.catalog.serializers import ProductDetailSerializer, ProductImageSerializer


class StrictQuantityField(serializers.IntegerField):
    def to_internal_value(self, data):
        if type(data) is not int:
            self.fail("invalid")
        return super().to_internal_value(data)


class ManageProductImageSerializer(ProductImageSerializer):
    class Meta(ProductImageSerializer.Meta):
        fields = ("id", *ProductImageSerializer.Meta.fields)
        read_only_fields = fields


class ManageProductSerializer(ProductDetailSerializer):
    stock_quantity = serializers.IntegerField(read_only=True)
    reserved_quantity = serializers.IntegerField(read_only=True)
    hidden_reason = serializers.SerializerMethodField()

    @extend_schema_field(ManageProductImageSerializer(many=True))
    def get_images(self, obj):
        return ManageProductImageSerializer(
            self.product_images(obj), many=True, context=self.context
        ).data

    class Meta(ProductDetailSerializer.Meta):
        fields = ProductDetailSerializer.Meta.fields + (
            "stock_quantity",
            "reserved_quantity",
            "is_published",
            "demo_source",
            "hidden_reason",
        )
        read_only_fields = fields

    def get_hidden_reason(self, product) -> str | None:
        if not product.is_published:
            return "unpublished"
        if product.origin == Product.Origin.DEMO and not self.context["demo_enabled"]:
            return "demo_disabled"
        return None


class ManageProductWriteSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Category.objects.filter(slug__in=ATTRIBUTES_BY_CATEGORY_SLUG),
    )
    stock_quantity = StrictQuantityField(min_value=0, max_value=2147483647)
    stock_change_reason = serializers.CharField(
        max_length=500, required=False, write_only=True
    )
    save_as_owner = serializers.BooleanField(required=False, write_only=True)

    class Meta:
        model = Product
        fields = (
            "name",
            "category",
            "short_description",
            "description",
            "price",
            "old_price",
            "attributes",
            "stock_quantity",
            "is_published",
            "stock_change_reason",
            "save_as_owner",
        )

    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            return super().to_internal_value(data)
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {field: ["This field cannot be set."] for field in sorted(unknown)}
            )
        return super().to_internal_value(data)

    def validate(self, data):
        instance = self.instance
        if instance and instance.origin == Product.Origin.DEMO:
            if not data.get("save_as_owner"):
                raise serializers.ValidationError(
                    {
                        "save_as_owner": [
                            "Save this demo product as your own to keep your changes "
                            "when the demo catalog is disabled."
                        ]
                    }
                )
        if "stock_change_reason" in data and "stock_quantity" not in data:
            raise serializers.ValidationError(
                {"stock_change_reason": ["Include stock_quantity with a stock reason."]}
            )
        candidate = Product()
        if instance:
            for field in Product._meta.concrete_fields:
                setattr(candidate, field.attname, getattr(instance, field.attname))
            candidate._state.adding = False
        for name, value in data.items():
            if name not in {"stock_quantity", "stock_change_reason", "save_as_owner"}:
                setattr(candidate, name, value)
        try:
            candidate.clean()
        except ModelValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return data


class CatalogStateSerializer(serializers.ModelSerializer):
    demo_product_count = serializers.IntegerField(read_only=True)
    owner_product_count = serializers.IntegerField(read_only=True)
    published_owner_product_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = CatalogState
        fields = (
            "demo_enabled",
            "switched_at",
            "demo_product_count",
            "owner_product_count",
            "published_owner_product_count",
        )
        read_only_fields = fields

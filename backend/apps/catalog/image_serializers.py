"""Staff gallery payloads; public image DTOs deliberately have no management ID."""

from uuid import uuid4

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.catalog.manage_serializers import StrictQuantityField
from config.serializers import StrictInputSerializer

MAX_IMAGE_BYTES = 4 * 1024 * 1024
IMAGE_FORMATS = {
    "JPEG": (".jpg", "image/jpeg"),
    "PNG": (".png", "image/png"),
    "WEBP": (".webp", "image/webp"),
}


@extend_schema_field(OpenApiTypes.BINARY)
class CatalogImageField(serializers.ImageField):
    def to_internal_value(self, data):
        image = serializers.FileField.to_internal_value(self, data)
        if image.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError("The image must be at most 4 MiB.")
        # Django's ImageField also validates filename extensions. Use a safe
        # provisional name so the contents, not the untrusted suffix, decide type.
        image.name = f"{uuid4().hex}.png"
        image = super().to_internal_value(image)
        # DRF/Django use Pillow to verify the actual contents, not the extension
        # or the browser's Content-Type. Keep only the three supported formats.
        image_format = image.image.format
        if image_format not in IMAGE_FORMATS:
            raise serializers.ValidationError("Use a JPEG, PNG or WebP image.")
        extension, content_type = IMAGE_FORMATS[image_format]
        image.name = f"{uuid4().hex}{extension}"
        image.content_type = content_type
        return image


class ProductImageUploadSerializer(StrictInputSerializer):
    image = CatalogImageField()

    def to_internal_value(self, data):
        if hasattr(data, "getlist") and len(data.getlist("image")) > 1:
            raise serializers.ValidationError(
                {"image": ["Upload one image at a time."]}
            )
        return super().to_internal_value(data)


class ProductImagePatchSerializer(StrictInputSerializer):
    order = StrictQuantityField(min_value=0, max_value=2147483647, required=False)
    is_main = serializers.BooleanField(required=False)


class ImageOperationErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()
    code = serializers.CharField()
    errors = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()), required=False
    )

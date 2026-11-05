"""Shared strict input contract for APIs that reject unknown request fields."""

from drf_spectacular.extensions import OpenApiSerializerExtension
from rest_framework import serializers


class StrictInputSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - self.fields.keys()
            if unknown:
                raise serializers.ValidationError(
                    {name: ["Unknown field."] for name in sorted(unknown)}
                )
        return super().to_internal_value(data)


class StrictInputSchema(OpenApiSerializerExtension):
    target_class = StrictInputSerializer
    match_subclasses = True

    def map_serializer(self, auto_schema, direction):
        schema = auto_schema._map_serializer(
            self.target, direction, bypass_extensions=True
        )
        schema["additionalProperties"] = False
        return schema

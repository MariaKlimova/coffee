"""Explicit private buyer projection and strictly bounded action input."""

from drf_spectacular.extensions import OpenApiSerializerExtension
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.orders.buyer_actions import buyer_allowed_actions
from apps.orders.models import CancellationRequest
from apps.orders.serializers import OrderSerializer


class BuyerOrderSerializer(OrderSerializer):
    class Meta(OrderSerializer.Meta):
        fields = tuple(
            field
            for field in OrderSerializer.Meta.fields
            if field not in ("guest_email", "guest_phone", "stock_review_reason")
        )
        read_only_fields = fields


class PublicCancellationRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = CancellationRequest
        fields = (
            "id",
            "reason",
            "state",
            "created_at",
            "decided_at",
            "public_response",
        )
        read_only_fields = fields


class BuyerActionsSerializer(serializers.Serializer):
    order = BuyerOrderSerializer(source="*", read_only=True)
    allowed_actions = serializers.SerializerMethodField()
    cancellation_requests = PublicCancellationRequestSerializer(
        many=True, read_only=True
    )

    @extend_schema_field(
        serializers.ListField(
            child=serializers.ChoiceField(choices=["cancel", "request_cancellation"])
        )
    )
    def get_allowed_actions(self, order):
        return buyer_allowed_actions(order)


class StrictActionSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - self.fields.keys()
            if unknown:
                raise serializers.ValidationError(
                    {name: ["Unknown field."] for name in sorted(unknown)}
                )
        return super().to_internal_value(data)


class BuyerCancelRequestSerializer(StrictActionSerializer):
    request_id = serializers.UUIDField()
    expected_status = serializers.ChoiceField(choices=["pending"])
    reason = serializers.CharField(max_length=500, allow_blank=True, default="")


class BuyerCancellationRequestSerializer(StrictActionSerializer):
    request_id = serializers.UUIDField()
    expected_status = serializers.ChoiceField(choices=["paid", "processing"])
    reason = serializers.CharField(max_length=500)


class CancellationDecisionSerializer(StrictActionSerializer):
    request_id = serializers.UUIDField()
    decision = serializers.ChoiceField(choices=["accept", "decline"])
    expected_status = serializers.ChoiceField(choices=["paid", "processing"])
    public_response = serializers.CharField(max_length=500)
    private_comment = serializers.CharField(
        max_length=500, allow_blank=True, default=""
    )


class GuestCheckoutRecoverySerializer(StrictActionSerializer):
    checkout_request_id = serializers.UUIDField()


class BuyerActionResponseSerializer(serializers.Serializer):
    order = BuyerOrderSerializer(read_only=True)
    buyer_actions = BuyerActionsSerializer(read_only=True)
    replayed = serializers.BooleanField(read_only=True)


class GuestCheckoutRecoveryResponseSerializer(serializers.Serializer):
    order = BuyerOrderSerializer(read_only=True)
    guest_action_token = serializers.CharField(read_only=True)
    guest_action_version = serializers.IntegerField(read_only=True)


class OrderCreateResponseSerializer(OrderSerializer):
    guest_action_token = serializers.CharField(read_only=True, required=False)
    guest_action_version = serializers.IntegerField(read_only=True, required=False)

    class Meta(OrderSerializer.Meta):
        fields = (
            *OrderSerializer.Meta.fields,
            "guest_action_token",
            "guest_action_version",
        )
        read_only_fields = fields


class StrictActionSchema(OpenApiSerializerExtension):
    target_class = StrictActionSerializer
    match_subclasses = True

    def map_serializer(self, auto_schema, direction):
        schema = auto_schema._map_serializer(
            self.target, direction, bypass_extensions=True
        )
        schema["additionalProperties"] = False
        return schema

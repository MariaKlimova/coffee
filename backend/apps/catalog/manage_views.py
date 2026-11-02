"""JWT staff-only catalog API. DELETE hides; no catalog relation is destroyed."""

from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from apps.catalog.filters import _parse_bool, filter_products
from apps.catalog.manage_serializers import (
    CatalogStateSerializer,
    ManageProductSerializer,
    ManageProductWriteSerializer,
)
from apps.catalog.manage_services import catalog_state, disable_demo, write_product
from apps.catalog.models import Product
from apps.catalog.pagination import CatalogPagination


@extend_schema_view(
    list=extend_schema(
        tags=["Manage catalog"],
        parameters=[
            OpenApiParameter("category", str),
            OpenApiParameter("search", str),
            OpenApiParameter("is_published", bool),
            OpenApiParameter("origin", str),
            OpenApiParameter("in_stock", bool),
            OpenApiParameter("price_min", str),
            OpenApiParameter("price_max", str),
            OpenApiParameter("ordering", str),
        ],
    ),
    retrieve=extend_schema(tags=["Manage catalog"]),
    create=extend_schema(
        tags=["Manage catalog"],
        request=ManageProductWriteSerializer,
        responses={201: ManageProductSerializer},
    ),
    partial_update=extend_schema(
        tags=["Manage catalog"],
        request=ManageProductWriteSerializer,
        responses={200: ManageProductSerializer},
    ),
    destroy=extend_schema(
        tags=["Manage catalog"],
        responses={204: None},
        description="Remove publication; preserve all data and relations.",
    ),
)
class ManageProductViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAdminUser]
    pagination_class = CatalogPagination
    serializer_class = ManageProductSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = Product.objects.select_related("category").prefetch_related("images")
        if self.action != "list":
            return qs
        # Reuse public filter validation, without its publication/visibility scope.
        qs = filter_products(qs, self.request.query_params)
        for field in ("is_published",):
            raw = self.request.query_params.get(field)
            if raw not in (None, ""):
                qs = qs.filter(**{field: _parse_bool(raw, field=field)})
        origin = self.request.query_params.get("origin")
        if origin:
            if origin not in Product.Origin.values:
                raise ValidationError({"origin": ["Must be demo or owner."]})
            qs = qs.filter(origin=origin)
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if getattr(self, "swagger_fake_view", False):
            context.update(demo_enabled=True, include_mock_images=True)
            return context
        context.update(
            demo_enabled=catalog_state().demo_enabled, include_mock_images=True
        )
        return context

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = ManageProductWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = write_product(data=serializer.validated_data, actor=request.user)
        return Response(
            self.get_serializer(product).data, status=status.HTTP_201_CREATED
        )

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        product = self.get_object()
        product = Product.objects.select_for_update().get(pk=product.pk)
        serializer = ManageProductWriteSerializer(
            product, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        product = write_product(
            data=serializer.validated_data, actor=request.user, product=product
        )
        return Response(self.get_serializer(product).data)

    @transaction.atomic
    def perform_destroy(self, instance):
        product = Product.objects.select_for_update().get(pk=instance.pk)
        product.is_published = False
        product.save(update_fields=["is_published", "updated_at"])


class CatalogStateViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = CatalogStateSerializer

    @extend_schema(tags=["Manage catalog"], responses={200: CatalogStateSerializer})
    def list(self, request):
        return Response(self.get_serializer(catalog_state()).data)

    @extend_schema(
        tags=["Manage catalog"],
        request=None,
        responses={200: CatalogStateSerializer},
        description=(
            "Idempotent one-way transition. Hide remaining demo products; "
            "keep owner products and all records."
        ),
    )
    @action(detail=False, methods=["post"], url_path="disable-demo")
    def disable_demo(self, request):
        return Response(self.get_serializer(disable_demo(actor=request.user)).data)

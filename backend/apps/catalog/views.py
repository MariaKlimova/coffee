"""Catalog API views: categories and products."""

from django.db.models import Prefetch, QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.filters import filter_products
from apps.catalog.models import Category, Product, ProductImage
from apps.catalog.pagination import CatalogPagination
from apps.catalog.serializers import (
    CategorySerializer,
    ProductDetailSerializer,
    ProductListSerializer,
)
from apps.catalog.visibility import visible_products
from apps.favorites.query import annotate_is_favorite

RELATED_PRODUCTS_LIMIT = 8


def _base_product_queryset() -> QuerySet[Product]:
    images_qs = ProductImage.objects.order_by("order", "id")
    return (
        visible_products()
        .select_related("category")
        .prefetch_related(
            Prefetch("images", queryset=images_qs),
        )
    )


class CategoryListView(APIView):
    """GET /api/categories/ — public category list."""

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Catalog"],
        responses={200: CategorySerializer(many=True)},
        auth=[],
    )
    def get(self, request: Request) -> Response:
        categories = Category.objects.all()
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema_view(
    list=extend_schema(
        tags=["Catalog"],
        parameters=[
            OpenApiParameter(
                name="category",
                type=str,
                location=OpenApiParameter.QUERY,
                enum=["coffee", "machines"],
                description="Filter by category slug",
            ),
            OpenApiParameter(
                name="in_stock",
                type=bool,
                location=OpenApiParameter.QUERY,
                description="Filter by availability",
            ),
            OpenApiParameter(
                name="price_min",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Minimum price (RUB decimal string)",
            ),
            OpenApiParameter(
                name="price_max",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Maximum price (RUB decimal string)",
            ),
            OpenApiParameter(
                name="search",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Search by product name (icontains)",
            ),
            OpenApiParameter(
                name="ordering",
                type=str,
                location=OpenApiParameter.QUERY,
                enum=["price", "-price", "created_at", "-created_at"],
                description="Sort order",
            ),
            OpenApiParameter(
                name="page",
                type=int,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="page_size",
                type=int,
                location=OpenApiParameter.QUERY,
            ),
        ],
        responses={200: ProductListSerializer(many=True)},
        auth=[],
    ),
    retrieve=extend_schema(
        tags=["Catalog"],
        responses={200: ProductDetailSerializer},
        auth=[],
    ),
    related=extend_schema(
        tags=["Catalog"],
        responses={200: ProductListSerializer(many=True)},
        auth=[],
        description=(
            "Up to 8 products from the same category, excluding the current "
            "product, ordered by -created_at."
        ),
    ),
)
class ProductViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Public product list and detail by slug."""

    permission_classes = [AllowAny]
    pagination_class = CatalogPagination
    lookup_field = "slug"
    lookup_url_kwarg = "slug"

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def get_queryset(self) -> QuerySet[Product]:
        qs = annotate_is_favorite(_base_product_queryset(), self.request.user)
        # List filters must not affect retrieve — stray query params would 404.
        if self.action != "list":
            return qs.order_by("-created_at")
        return filter_products(qs, self.request.query_params)

    @action(detail=True, methods=["get"], url_path="related")
    def related(self, request: Request, slug: str | None = None) -> Response:
        """GET /api/products/{slug}/related/ — same-category neighbors."""
        product = self.get_object()
        qs = annotate_is_favorite(
            _base_product_queryset()
            .filter(category_id=product.category_id)
            .exclude(pk=product.pk)
            .order_by("-created_at"),
            request.user,
        )[:RELATED_PRODUCTS_LIMIT]
        serializer = ProductListSerializer(
            qs,
            many=True,
            context={"request": request},
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

"""Catalog API views: categories and products."""

from decimal import Decimal, InvalidOperation

from django.db.models import Prefetch, QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Category, Product, ProductImage
from apps.catalog.pagination import CatalogPagination
from apps.catalog.serializers import (
    CategorySerializer,
    ProductDetailSerializer,
    ProductListSerializer,
)

ORDERING_MAP = {
    "price": ("price",),
    "-price": ("-price",),
    "created_at": ("created_at",),
    "-created_at": ("-created_at",),
}
ALLOWED_CATEGORIES = frozenset({"coffee", "machines"})


def _parse_bool(raw: str, *, field: str) -> bool:
    lowered = raw.lower()
    if lowered in {"true", "1", "yes"}:
        return True
    if lowered in {"false", "0", "no"}:
        return False
    raise ValidationError({field: [f"Must be a boolean (got {raw!r})."]})


def _parse_decimal(raw: str, *, field: str) -> Decimal:
    try:
        return Decimal(raw)
    except InvalidOperation as exc:
        raise ValidationError(
            {field: [f"Must be a decimal string (got {raw!r})."]},
        ) from exc


def _base_product_queryset() -> QuerySet[Product]:
    images_qs = ProductImage.objects.order_by("order", "id")
    return Product.objects.select_related("category").prefetch_related(
        Prefetch("images", queryset=images_qs),
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
        qs = _base_product_queryset()
        # List filters must not affect retrieve — stray query params would 404.
        if self.action != "list":
            return qs.order_by("-created_at")
        return self._filter_list_queryset(qs)

    def _filter_list_queryset(self, qs: QuerySet[Product]) -> QuerySet[Product]:
        params = self.request.query_params

        category = params.get("category")
        if category is not None and category != "":
            if category not in ALLOWED_CATEGORIES:
                raise ValidationError(
                    {
                        "category": [
                            "Must be one of: coffee, machines " f"(got {category!r})."
                        ],
                    },
                )
            qs = qs.filter(category__slug=category)

        in_stock_raw = params.get("in_stock")
        if in_stock_raw is not None and in_stock_raw != "":
            qs = qs.filter(in_stock=_parse_bool(in_stock_raw, field="in_stock"))

        price_min_raw = params.get("price_min")
        if price_min_raw is not None and price_min_raw != "":
            qs = qs.filter(
                price__gte=_parse_decimal(price_min_raw, field="price_min"),
            )

        price_max_raw = params.get("price_max")
        if price_max_raw is not None and price_max_raw != "":
            qs = qs.filter(
                price__lte=_parse_decimal(price_max_raw, field="price_max"),
            )

        search = params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)

        ordering = params.get("ordering")
        if ordering is None or ordering == "":
            order_by = ORDERING_MAP["-created_at"]
        elif ordering in ORDERING_MAP:
            order_by = ORDERING_MAP[ordering]
        else:
            allowed = ", ".join(ORDERING_MAP)
            raise ValidationError(
                {
                    "ordering": [
                        f"Must be one of: {allowed} (got {ordering!r}).",
                    ],
                },
            )

        return qs.order_by(*order_by)

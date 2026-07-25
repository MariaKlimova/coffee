"""Favorites API: list, add, remove."""

from django.db import IntegrityError
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.catalog.pagination import CatalogPagination
from apps.catalog.serializers import ProductListSerializer
from apps.favorites.models import Favorite
from apps.favorites.query import favorite_products_queryset
from apps.favorites.serializers import FavoriteCreateSerializer, FavoriteSerializer


class FavoritesListCreateView(APIView):
    """GET/POST /api/favorites/ — list and add favorites for the current user."""

    permission_classes = [IsAuthenticated]
    pagination_class = CatalogPagination

    @extend_schema(
        tags=["Favorites"],
        responses={200: ProductListSerializer(many=True)},
    )
    def get(self, request: Request) -> Response:
        qs = favorite_products_queryset(user=request.user)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        serializer = ProductListSerializer(
            page,
            many=True,
            context={"request": request},
        )
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=["Favorites"],
        request=FavoriteCreateSerializer,
        responses={201: FavoriteSerializer},
        description=(
            "Add a product to favorites. Idempotent: if already favorited, "
            "returns 201 with the existing Favorite (no duplicate row)."
        ),
    )
    def post(self, request: Request) -> Response:
        create_serializer = FavoriteCreateSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)
        product_id = create_serializer.validated_data["product_id"]

        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist as exc:
            raise NotFound(
                detail="Product not found.",
                code="not_found",
            ) from exc

        try:
            favorite, _created = Favorite.objects.get_or_create(
                user=request.user,
                product=product,
            )
        except IntegrityError:
            # Concurrent POST hit UniqueConstraint after the initial get.
            favorite = Favorite.objects.get(user=request.user, product=product)

        return Response(
            FavoriteSerializer(favorite).data,
            status=status.HTTP_201_CREATED,
        )


class FavoriteDestroyView(APIView):
    """DELETE /api/favorites/{product_id}/ — remove one favorite."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Favorites"],
        responses={204: None},
    )
    def delete(self, request: Request, product_id) -> Response:
        deleted, _ = Favorite.objects.filter(
            user=request.user,
            product_id=product_id,
        ).delete()
        if deleted == 0:
            raise NotFound(
                detail="Product is not in your favorites.",
                code="not_found",
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

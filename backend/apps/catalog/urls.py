"""URL routes for catalog endpoints."""

from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.catalog.image_views import ProductImageDetailView, ProductImageUploadView
from apps.catalog.manage_views import CatalogStateViewSet, ManageProductViewSet
from apps.catalog.views import CategoryListView, ProductViewSet

router = SimpleRouter()
router.register("products", ProductViewSet, basename="product")
router.register("manage/products", ManageProductViewSet, basename="manage-product")
router.register("manage/catalog", CatalogStateViewSet, basename="manage-catalog")

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path(
        "manage/products/<uuid:id>/images/",
        ProductImageUploadView.as_view(),
        name="manage-product-image-upload",
    ),
    path(
        "manage/products/<uuid:id>/images/<int:image_id>/",
        ProductImageDetailView.as_view(),
        name="manage-product-image-detail",
    ),
    *router.urls,
]

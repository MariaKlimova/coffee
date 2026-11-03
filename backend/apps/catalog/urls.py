"""URL routes for catalog endpoints."""

from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.catalog.manage_views import CatalogStateViewSet, ManageProductViewSet
from apps.catalog.views import CategoryListView, ProductViewSet

router = SimpleRouter()
router.register("products", ProductViewSet, basename="product")
router.register("manage/products", ManageProductViewSet, basename="manage-product")
router.register("manage/catalog", CatalogStateViewSet, basename="manage-catalog")

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="category-list"),
    *router.urls,
]

"""URL routes for catalog endpoints."""

from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.catalog.views import CategoryListView, ProductViewSet

router = SimpleRouter()
router.register("products", ProductViewSet, basename="product")

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="category-list"),
    *router.urls,
]

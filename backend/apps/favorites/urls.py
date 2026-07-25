"""URL routes for favorites."""

from django.urls import path

from apps.favorites.views import FavoriteDestroyView, FavoritesListCreateView

urlpatterns = [
    path(
        "favorites/",
        FavoritesListCreateView.as_view(),
        name="favorite-list",
    ),
    path(
        "favorites/<uuid:product_id>/",
        FavoriteDestroyView.as_view(),
        name="favorite-detail",
    ),
]

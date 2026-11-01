"""URL configuration for the Coffee Shop API."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from config.views import HealthView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/auth/", include("apps.users.urls")),
    path("api/", include("apps.catalog.urls")),
    path("api/", include("apps.favorites.urls")),
    path("api/", include("apps.cart.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/", include("apps.payments.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]

# Local media routes belong only to the filesystem backend, including in DEBUG.
if settings.MEDIA_STORAGE == "filesystem":
    if settings.DEBUG:
        urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    elif settings.SERVE_MEDIA:
        urlpatterns += [
            re_path(
                r"^media/(?P<path>.*)$",
                serve,
                {"document_root": settings.MEDIA_ROOT},
            ),
        ]

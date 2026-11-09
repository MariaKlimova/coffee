"""Local filesystem media must never be exposed by the S3 configuration."""

from importlib import reload

import pytest
from django.test import RequestFactory, override_settings
from django.urls import Resolver404, clear_url_caches, resolve
from django.views.static import serve

from config import urls


@pytest.mark.django_db
@pytest.mark.parametrize("debug", [False, True])
@pytest.mark.parametrize("storage", ["filesystem", "s3", "vercel_blob"])
@pytest.mark.parametrize("serve_media", [False, True])
def test_local_media_routes_require_filesystem(debug, storage, serve_media, tmp_path):
    (tmp_path / "probe.txt").write_text("local media probe")
    try:
        with override_settings(
            DEBUG=debug,
            MEDIA_STORAGE=storage,
            SERVE_MEDIA=serve_media,
            MEDIA_ROOT=tmp_path,
        ):
            patterns = tuple(reload(urls).urlpatterns)
            if storage == "filesystem" and (debug or serve_media):
                match = resolve("/media/probe.txt", urlconf=patterns)
                assert match.func is serve
                response = match.func(
                    RequestFactory().get("/media/probe.txt"), **match.kwargs
                )
                try:
                    assert response.status_code == 200
                    assert b"".join(response.streaming_content) == b"local media probe"
                finally:
                    response.close()
            else:
                with pytest.raises(Resolver404):
                    resolve("/media/probe.txt", urlconf=patterns)
    finally:
        reload(urls)
        clear_url_caches()

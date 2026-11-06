"""Django Blob storage boundary against the installed official SDK, offline."""

from datetime import UTC, datetime
from unittest.mock import MagicMock, Mock

import environ
import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured, SuspiciousFileOperation
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.db import transaction
from django.db.backends.base.base import BaseDatabaseWrapper
from django.test import override_settings
from django.urls import reverse
from vercel.blob import sync as blob

from apps.catalog.models import Category, Product, ProductImage
from config.blob_storage import BlobStorage
from config.media_storage import media_storage
from tests.test_catalog_api import _png

ORIGIN = "https://teststore41.public.blob.vercel-storage.com"


@pytest.fixture(autouse=True)
def forbid_provider_network(monkeypatch):
    import httpx2

    send = Mock(
        side_effect=AssertionError("Offline Blob tests must not contact providers")
    )
    monkeypatch.setattr(httpx2.Client, "send", send)
    return send


@pytest.fixture
def blob_config(monkeypatch):
    monkeypatch.setenv("MEDIA_STORAGE", "vercel_blob")
    monkeypatch.setenv("BLOB_STORE_ID", "store_TestStore41")
    monkeypatch.setenv("BLOB_PUBLIC_BASE_URL", ORIGIN)
    return media_storage(environ.Env())


@pytest.fixture
def storage(blob_config):
    return BlobStorage(**blob_config["OPTIONS"])


@pytest.fixture
def offline_blob(monkeypatch):
    objects = {}
    uploaded_at = datetime(2026, 1, 1, tzinfo=UTC)

    def head(name):
        if name not in objects:
            raise blob.BlobNotFoundError()
        return blob.HeadResult(
            url=f"{ORIGIN}/{name}",
            download_url=f"{ORIGIN}/{name}?download=1",
            pathname=name,
            size=len(objects[name]),
            etag="synthetic-etag",
            uploaded_at=uploaded_at,
            content_type="image/png",
            content_disposition="inline",
            cache_control="public",
        )

    def put(name, source, **options):
        assert options["access"] == "public"
        assert options["allow_overwrite"] is False
        assert options["add_random_suffix"] is False
        if name in objects:
            raise blob.BlobError("Object already exists", status_code=409)
        data = source.read()
        assert len(data) == options["content_length"]
        objects[name] = data
        return blob.PutResult(
            url=f"{ORIGIN}/{name}",
            download_url=f"{ORIGIN}/{name}?download=1",
            pathname=name,
            content_type=options["content_type"],
            content_disposition="inline",
            etag="synthetic-etag",
        )

    def get(name, *, access):
        assert access == "public"
        head(name)
        return blob.GetResult(
            metadata=blob.DownloadMetadata(url=f"{ORIGIN}/{name}", status_code=200),
            body=objects[name],
        )

    monkeypatch.setattr(blob, "head_blob", Mock(side_effect=head))
    monkeypatch.setattr(blob, "put_blob", Mock(side_effect=put))
    monkeypatch.setattr(blob, "get_blob", Mock(side_effect=get))
    monkeypatch.setattr(
        blob, "delete_blob", Mock(side_effect=lambda name: objects.pop(name, None))
    )
    return objects


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("BLOB_STORE_ID", ""),
        ("BLOB_STORE_ID", "store_bad/store"),
        ("BLOB_PUBLIC_BASE_URL", ""),
        ("BLOB_PUBLIC_BASE_URL", "http://teststore41.public.blob.vercel-storage.com"),
        ("BLOB_PUBLIC_BASE_URL", "https://other.public.blob.vercel-storage.com"),
        ("BLOB_PUBLIC_BASE_URL", ORIGIN + "/path"),
        ("BLOB_PUBLIC_BASE_URL", ORIGIN + "?token=secret"),
        ("BLOB_PUBLIC_BASE_URL", ORIGIN + ":443"),
    ],
)
def test_blob_configuration_requires_exact_public_store(
    blob_config, monkeypatch, key, value
):
    monkeypatch.setenv(key, value)
    with pytest.raises(ImproperlyConfigured, match=key):
        media_storage(environ.Env())


def test_initialization_and_public_urls_need_no_credentials_or_sdk_session(
    blob_config, monkeypatch
):
    import vercel.api

    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    monkeypatch.delenv("VERCEL_OIDC_TOKEN", raising=False)
    session = Mock(
        side_effect=AssertionError("URL generation must not create an SDK session")
    )
    monkeypatch.setattr(vercel.api, "session", session)
    storage = BlobStorage(**blob_config["OPTIONS"])
    assert (
        storage.url("products/Кофе ?#%.png")
        == ORIGIN + "/products/%D0%9A%D0%BE%D1%84%D0%B5%20%3F%23%25.png"
    )
    session.assert_not_called()


@pytest.mark.parametrize(
    "name",
    [
        "../secret",
        "/absolute.png",
        "a/../b",
        "a//b",
        "a/./b",
        "a\\b",
        "a\n.png",
        "a\x7f.png",
    ],
)
def test_invalid_names_never_reach_sdk(storage, name, monkeypatch):
    call = Mock()
    monkeypatch.setattr(blob, "head_blob", call)
    with pytest.raises(SuspiciousFileOperation):
        storage.exists(name)
    call.assert_not_called()


def test_save_rewinds_stream_and_same_name_never_overwrites(storage, offline_blob):
    first = ContentFile(b"first", name="photo.png")
    first.seek(3)
    first_key = storage.save("products/2026/11/photo.png", first, max_length=100)
    second_key = storage.save(
        "products/2026/11/photo.png", ContentFile(b"second"), max_length=100
    )
    assert first_key != second_key
    assert len(first_key) <= 100 and len(second_key) <= 100
    assert offline_blob[first_key] == b"first" and offline_blob[second_key] == b"second"
    assert not first.closed
    assert storage.size(first_key) == 5
    assert storage.get_modified_time(first_key).tzinfo is not None
    with storage.open(first_key) as stored:
        assert stored.read() == b"first"
    storage.delete(first_key)
    storage.delete(first_key)
    assert not storage.exists(first_key)
    assert storage.exists(second_key)


def test_race_after_head_must_not_overwrite_or_retry_consumed_upload(
    storage, offline_blob, monkeypatch
):
    offline_blob["products/existing.png"] = b"owner-image"
    monkeypatch.setattr(
        storage, "get_available_name", lambda name, max_length=None: name
    )
    with pytest.raises(OSError, match="image storage request failed"):
        storage.save("products/existing.png", ContentFile(b"replacement"))
    assert offline_blob["products/existing.png"] == b"owner-image"
    assert blob.put_blob.call_count == 1


@pytest.mark.parametrize(
    "error",
    [
        blob.BlobAccessError("synthetic-secret"),
        blob.BlobStoreNotFoundError(),
        blob.BlobServiceRateLimited(),
        blob.BlobError("synthetic-secret"),
    ],
)
def test_failed_head_is_not_missing_and_sdk_messages_are_not_exposed(
    storage, monkeypatch, error
):
    monkeypatch.setattr(blob, "head_blob", Mock(side_effect=error))
    with pytest.raises(OSError) as raised:
        storage.exists("products/test.png")
    assert "synthetic-secret" not in str(raised.value)
    assert raised.value.__suppress_context__


def test_only_missing_blob_returns_false(storage, monkeypatch):
    monkeypatch.setattr(blob, "head_blob", Mock(side_effect=blob.BlobNotFoundError()))
    assert storage.exists("products/test.png") is False
    with pytest.raises(FileNotFoundError):
        storage.size("products/test.png")


def test_sdk_rejects_fallback_token_for_another_store_before_network(
    storage, monkeypatch, forbid_provider_network
):
    import vercel.oidc

    monkeypatch.setattr(
        vercel.oidc,
        "get_vercel_oidc_token_sync",
        Mock(side_effect=vercel.oidc.VercelOidcTokenError("No OIDC in offline test")),
    )
    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_OtherStore_secret")
    with pytest.raises(OSError, match="image storage request failed"):
        storage.exists("products/test.png")
    forbid_provider_network.assert_not_called()


def test_credentials_factory_pins_store_and_prefers_oidc(storage, monkeypatch):
    import vercel.api
    import vercel.oidc

    scope = MagicMock()
    monkeypatch.setattr(vercel.api, "session", scope)
    monkeypatch.setattr(
        vercel.oidc, "get_vercel_oidc_token_sync", Mock(return_value="offline-oidc")
    )
    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_OtherStore_secret")
    monkeypatch.setattr(blob, "head_blob", Mock())
    assert storage.exists("products/test.png")
    options = scope.call_args.kwargs["service_options"][0]
    credentials = options.credentials_factory()
    assert credentials.store_id == "store_TestStore41"
    assert credentials.kind == blob.CredentialKind.OIDC
    assert credentials.token == "offline-oidc"


def test_storage_refuses_mutating_open_modes(storage):
    with pytest.raises(ValueError, match="only be opened for reading"):
        storage.open("products/test.png", "wb")


def test_immutable_name_must_fit_field_before_network(storage, forbid_provider_network):
    with pytest.raises(SuspiciousFileOperation, match="field limit"):
        storage.save("products/test.png", ContentFile(b"image"), max_length=20)
    forbid_provider_network.assert_not_called()


def test_blob_build_checks_and_collectstatic_make_no_provider_or_db_requests(
    blob_config, monkeypatch, tmp_path
):
    blocked = Mock(side_effect=AssertionError("Build must not contact DB or Blob"))
    monkeypatch.setattr(BaseDatabaseWrapper, "ensure_connection", blocked)
    monkeypatch.setattr(blob, "head_blob", blocked)
    monkeypatch.setattr(blob, "put_blob", blocked)
    config = {
        "default": blob_config,
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
    with override_settings(STORAGES=config, STATIC_ROOT=tmp_path):
        call_command("check", verbosity=0)
        call_command("collectstatic", interactive=False, verbosity=0)
    blocked.assert_not_called()


@pytest.mark.django_db
def test_imagefield_blob_upload_and_api_urls(blob_config, offline_blob, api_client):
    config = {
        "default": blob_config,
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
    with override_settings(STORAGES=config):
        category = Category.objects.create(name="Кофе", slug="blob-coffee")
        product = Product.objects.create(
            name="Blob image",
            slug="blob-image",
            category=category,
            price="100.00",
            short_description="Synthetic image upload",
        )
        image = ProductImage.objects.create(
            product=product, image=_png("long-name" * 20 + ".png"), is_main=True
        )
        assert len(image.image.name) <= 100
        assert image.image.name in offline_blob
        assert blob.put_blob.call_args.kwargs["content_type"] == "image/png"
        blob.head_blob.reset_mock()
        detail = api_client.get(reverse("product-detail", args=[product.slug]))
        listing = api_client.get(reverse("product-list"))
        assert detail.status_code == listing.status_code == 200
        expected = default_storage.url(image.image.name)
        assert detail.json()["image_url"] == expected
        assert detail.json()["images"][0]["url"] == expected
        assert listing.json()["results"][0]["image_url"] == expected
        blob.head_blob.assert_not_called()


@pytest.mark.django_db
def test_failed_upload_creates_no_image_row(blob_config, offline_blob, monkeypatch):
    config = {
        "default": blob_config,
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
    with override_settings(STORAGES=config):
        category = Category.objects.create(name="Кофе", slug="failed-blob")
        product = Product.objects.create(
            name="Failed blob",
            slug="failed-blob",
            category=category,
            price="100.00",
            short_description="Synthetic failed image upload",
        )
        monkeypatch.setattr(blob, "put_blob", Mock(side_effect=blob.BlobAccessError()))
        with pytest.raises(PermissionError), transaction.atomic():
            ProductImage.objects.create(product=product, image=_png("test.png"))
        assert not product.images.exists()


@pytest.mark.django_db
def test_django_admin_inline_upload_uses_blob_without_changing_counts(
    blob_config, offline_blob, client
):
    account = get_user_model().objects.create_user(
        email="blob-admin@example.test",
        password="SyntheticBlob1",
        is_staff=True,
        is_superuser=True,
    )
    client.force_login(account)
    category = Category.objects.create(name="Кофе", slug="blob-admin")
    product = Product.objects.create(
        name="Admin image",
        slug="admin-image",
        category=category,
        short_description="Synthetic admin upload",
        price="100.00",
        stock_quantity=7,
        reserved_quantity=2,
    )
    config = {
        "default": blob_config,
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
    with override_settings(STORAGES=config):
        response = client.post(
            reverse("admin:catalog_product_change", args=[product.pk]),
            {
                "name": product.name,
                "slug": product.slug,
                "category": str(category.pk),
                "short_description": product.short_description,
                "description": "",
                "price": "100.00",
                "old_price": "",
                "is_published": "on",
                "origin": "owner",
                "attributes": "{}",
                "images-TOTAL_FORMS": "1",
                "images-INITIAL_FORMS": "0",
                "images-MIN_NUM_FORMS": "0",
                "images-MAX_NUM_FORMS": "1000",
                "images-0-image": _png("admin.png"),
                "images-0-order": "0",
                "images-0-is_main": "on",
                "_save": "Save",
            },
        )
        assert response.status_code == 302
        image = product.images.get()
        assert image.image.name in offline_blob and image.is_main
        product.refresh_from_db()
        assert (product.stock_quantity, product.reserved_quantity) == (7, 2)

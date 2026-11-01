"""S3 configuration and ImageField boundary tests; no live cloud requests."""

import environ
import pytest
from boto3.s3.transfer import TransferConfig
from botocore.stub import ANY, Stubber
from django.core.exceptions import ImproperlyConfigured
from django.core.files.storage import default_storage
from django.test import override_settings
from django.urls import reverse
from storages.backends.s3 import S3Storage

from apps.catalog.models import Category, Product, ProductImage
from config.media_storage import media_storage
from tests.test_catalog_api import _png


@pytest.fixture
def s3_env(monkeypatch):
    values = {
        "MEDIA_STORAGE": "s3",
        "AWS_ACCESS_KEY_ID": "test-access-key",
        "AWS_SECRET_ACCESS_KEY": "test-secret-key",
        "AWS_STORAGE_BUCKET_NAME": "coffee-test-media",
        "AWS_S3_ENDPOINT_URL": "https://storage.example.test",
        "AWS_S3_REGION_NAME": "eu-central-1",
        "AWS_S3_ADDRESSING_STYLE": "path",
        "AWS_S3_CUSTOM_DOMAIN": "",
    }
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    return environ.Env()


def test_filesystem_is_local_default(monkeypatch):
    monkeypatch.delenv("MEDIA_STORAGE", raising=False)
    assert media_storage(environ.Env()) == {
        "BACKEND": "django.core.files.storage.FileSystemStorage"
    }


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("MEDIA_STORAGE", "typo"),
        ("AWS_ACCESS_KEY_ID", ""),
        ("AWS_SECRET_ACCESS_KEY", "  "),
        ("AWS_STORAGE_BUCKET_NAME", ""),
        ("AWS_S3_ENDPOINT_URL", "storage.example.test"),
        ("AWS_S3_ENDPOINT_URL", "https://user:secret@storage.example.test"),
        ("AWS_S3_CUSTOM_DOMAIN", "https://cdn.example.test/"),
        ("AWS_S3_ADDRESSING_STYLE", "invalid"),
    ],
)
def test_invalid_s3_configuration_fails_closed(s3_env, monkeypatch, key, value):
    monkeypatch.setenv(key, value)
    with pytest.raises(ImproperlyConfigured, match=key):
        media_storage(s3_env)


def test_custom_domain_gives_stable_public_https_url(s3_env, monkeypatch):
    monkeypatch.setenv("AWS_S3_CUSTOM_DOMAIN", "cdn.example.test")
    config = media_storage(s3_env)
    storage = S3Storage(**config["OPTIONS"])
    assert storage.url("products/test image.png") == (
        "https://cdn.example.test/products/test%20image.png"
    )


@pytest.mark.django_db
def test_imagefield_saves_to_s3_and_api_keeps_public_urls(s3_env, api_client):
    config = media_storage(s3_env)
    config["OPTIONS"]["transfer_config"] = TransferConfig(use_threads=False)
    storages = {
        "default": config,
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
    with override_settings(STORAGES=storages):
        storage = default_storage
        client = storage.connection.meta.client
        uploads = []

        def capture_upload(params, **kwargs):
            uploads.append(params.copy())

        client.meta.events.register(
            "before-parameter-build.s3.PutObject", capture_upload
        )
        category = Category.objects.create(name="Кофе", slug="coffee")
        product = Product.objects.create(
            name="Storage test",
            slug="storage-test",
            short_description="Storage test",
            category=category,
            price="100.00",
        )
        with Stubber(client) as stubber:
            stubber.add_client_error(
                "head_object",
                service_error_code="404",
                http_status_code=404,
                expected_params={"Bucket": "coffee-test-media", "Key": ANY},
            )
            stubber.add_response("put_object", {})
            image = ProductImage.objects.create(
                product=product, image=_png("test image.png"), is_main=True
            )
            stubber.assert_no_pending_responses()

        assert len(uploads) == 1
        assert uploads[0]["Bucket"] == "coffee-test-media"
        assert uploads[0]["Key"] == image.image.name
        assert uploads[0]["ContentType"] == "image/png"
        assert "ACL" not in uploads[0]
        url = image.image.url
        assert (
            url == f"https://storage.example.test/coffee-test-media/{image.image.name}"
        )
        assert "?" not in url
        assert S3Storage(**config["OPTIONS"]).url(image.image.name) == url

        detail = api_client.get(reverse("product-detail", args=[product.slug]))
        assert detail.status_code == 200
        assert detail.json()["image_url"] == url
        assert detail.json()["images"][0]["url"] == url
        listing = api_client.get(reverse("product-list"))
        assert listing.status_code == 200
        assert listing.json()["results"][0]["image_url"] == url


def test_s3_preserves_existing_object_on_name_collision(s3_env):
    storage = S3Storage(**media_storage(s3_env)["OPTIONS"])
    client = storage.connection.meta.client
    with Stubber(client) as stubber:
        stubber.add_response(
            "head_object",
            {},
            {"Bucket": "coffee-test-media", "Key": "products/test.png"},
        )
        stubber.add_client_error(
            "head_object",
            service_error_code="404",
            http_status_code=404,
            expected_params={"Bucket": "coffee-test-media", "Key": ANY},
        )
        name = storage.get_available_name("products/test.png")
        stubber.assert_no_pending_responses()
    assert name.startswith("products/test_")
    assert name.endswith(".png")

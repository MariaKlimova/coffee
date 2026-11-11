"""Staff gallery HTTP contract, storage failures and PostgreSQL serialization."""

from io import BytesIO
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework.test import APIClient

from apps.catalog.image_serializers import (
    MAX_IMAGE_BYTES,
    ProductImageUploadSerializer,
)
from apps.catalog.image_services import (
    delete_product_image,
    patch_product_image,
    upload_product_image,
)
from apps.catalog.models import Category, Product, ProductImage
from config.blob_storage import BlobStorage
from tests.helpers import auth_client
from tests.test_inventory import race

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def isolated_media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def staff(user):
    user.is_staff = True
    user.save(update_fields=["is_staff"])
    return user


@pytest.fixture
def staff_client(staff):
    client = APIClient()
    auth_client(client, staff)
    return client


def image_file(image_format="PNG", name="photo.png", content_type="image/png"):
    contents = BytesIO()
    Image.new("RGB", (3, 2), "#ad834b").save(contents, format=image_format)
    return SimpleUploadedFile(name, contents.getvalue(), content_type=content_type)


def upload_url(product):
    return reverse("manage-product-image-upload", args=[product.pk])


def image_url(product, image_id):
    return reverse("manage-product-image-detail", args=[product.pk, image_id])


def upload(client, product, **kwargs):
    response = client.post(
        upload_url(product), {"image": image_file(**kwargs)}, format="multipart"
    )
    assert response.status_code == 201, response.json()
    return response.json()


def gallery(product):
    return list(product.images.values_list("pk", "order", "is_main"))


@pytest.mark.parametrize("role,expected", [("anonymous", 401), ("buyer", 403)])
def test_every_image_write_requires_staff(api_client, user, products, role, expected):
    product = products["cheap"]
    existing = ProductImage.objects.create(
        product=product, image=image_file(), is_main=True
    )
    before = list(product.images.values())
    with existing.image.open("rb") as file:
        original_bytes = file.read()
    if role == "buyer":
        auth_client(api_client, user)
    assert (
        api_client.post(
            upload_url(product), {"image": image_file()}, format="multipart"
        ).status_code
        == expected
    )
    assert (
        api_client.patch(
            image_url(product, existing.pk), {"is_main": False}, format="json"
        ).status_code
        == expected
    )
    assert api_client.delete(image_url(product, existing.pk)).status_code == expected
    assert list(product.images.values()) == before
    assert existing.image.storage.exists(existing.image.name)
    with existing.image.open("rb") as file:
        assert file.read() == original_bytes


def test_gallery_rejects_unsupported_content_types_without_changes(
    staff_client, products
):
    product = products["cheap"]
    photo = upload(staff_client, product)
    before = list(product.images.values())
    requests = [
        staff_client.post(
            upload_url(product), {"image": "not multipart"}, format="json"
        ),
        staff_client.patch(
            image_url(product, photo["id"]), {"is_main": "false"}, format="multipart"
        ),
    ]
    for response in requests:
        assert response.status_code == 415
        assert response.json()["code"] == "unsupported_media_type"
    assert list(product.images.values()) == before
    image = product.images.get()
    assert image.image.storage.exists(image.image.name)


@pytest.mark.parametrize("category_slug", ["coffee", "machines"])
def test_owner_publication_lifecycle_is_consistent_across_public_endpoints(
    staff_client, products, category_slug
):
    category, _ = Category.objects.get_or_create(
        slug=category_slug, defaults={"name": category_slug}
    )
    neighbor = Product.objects.create(
        category=category,
        name="Published neighbor",
        slug=f"neighbor-{category_slug}",
        short_description="For related products",
        price="500.00",
    )
    response = staff_client.post(
        reverse("manage-product-list"),
        {
            "category": category_slug,
            "name": "Owner lifecycle",
            "short_description": "Created in manage",
            "price": "750.00",
            "stock_quantity": 3,
            "is_published": False,
        },
        format="json",
    )
    assert response.status_code == 201, response.json()
    product = Product.objects.get(pk=response.json()["id"])
    photo = upload(staff_client, product)
    public = APIClient()
    detail_url = reverse("product-detail", args=[product.slug])
    related_url = reverse("product-related", args=[neighbor.slug])
    manage_url = reverse("manage-product-detail", args=[product.pk])

    def assert_visibility(published):
        listing = public.get(
            reverse("product-list"), {"category": category_slug, "search": product.name}
        )
        assert listing.status_code == 200
        assert listing.json()["count"] == int(published)
        related = public.get(related_url)
        assert related.status_code == 200
        assert (str(product.pk) in {row["id"] for row in related.json()}) is published
        detail_response = public.get(detail_url)
        assert detail_response.status_code == (200 if published else 404)
        if published:
            assert detail_response.json()["image_url"] == photo["url"]
            assert detail_response.json()["available_quantity"] == 3

    assert_visibility(False)
    assert (
        public.get(reverse("product-related", args=[product.slug])).status_code == 404
    )
    assert (
        staff_client.patch(
            manage_url, {"is_published": True}, format="json"
        ).status_code
        == 200
    )
    assert_visibility(True)
    assert staff_client.delete(manage_url).status_code == 204
    assert_visibility(False)
    managed = staff_client.get(manage_url)
    assert managed.status_code == 200
    assert managed.json()["hidden_reason"] == "unpublished"
    assert managed.json()["images"] == [photo]
    assert managed.json()["stock_quantity"] == 3
    assert product.images.get().image.storage.exists(product.images.get().image.name)


@pytest.mark.parametrize("image_format", ["JPEG", "PNG", "WEBP"])
def test_verified_upload_returns_url_and_staff_id(staff_client, products, image_format):
    product = products["cheap"]
    # The actual contents determine the extension and stored Content-Type.
    data = upload(
        staff_client,
        product,
        image_format=image_format,
        name="untrusted.svg",
        content_type="text/html",
    )
    assert set(data) == {"id", "url", "order", "is_main", "is_mock"}
    assert isinstance(data["id"], int)
    assert data["is_main"] is True and data["order"] == 0
    assert data["is_mock"] is False
    image = ProductImage.objects.get(pk=data["id"])
    assert image.image.storage.exists(image.image.name)
    assert data["url"].startswith("http://testserver/media/products/")
    with image.image.open("rb") as file:
        assert Image.open(file).format == image_format
    managed = staff_client.get(
        reverse("manage-product-detail", args=[product.pk])
    ).json()
    assert managed["images"] == [data]
    public = APIClient().get(reverse("product-detail", args=[product.slug])).json()
    assert "id" not in public["images"][0]
    assert public["image_url"] == data["url"]


def test_order_main_delete_and_unpublished_gallery(staff_client, products):
    product = products["cheap"]
    Product.objects.filter(pk=product.pk).update(is_published=False)
    first, second, third = [upload(staff_client, product) for _ in range(3)]
    assert gallery(product) == [
        (first["id"], 0, True),
        (second["id"], 1, False),
        (third["id"], 2, False),
    ]
    response = staff_client.patch(
        image_url(product, third["id"]),
        {"order": 0, "is_main": True},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["order"] == 0 and response.json()["is_main"] is True
    assert gallery(product) == [
        (third["id"], 0, True),
        (first["id"], 1, False),
        (second["id"], 2, False),
    ]
    deleted = ProductImage.objects.get(pk=third["id"])
    storage, name = deleted.image.storage, deleted.image.name
    assert staff_client.delete(image_url(product, deleted.pk)).status_code == 204
    assert not storage.exists(name)
    assert gallery(product) == [(first["id"], 0, True), (second["id"], 1, False)]
    assert staff_client.delete(image_url(product, second["id"])).status_code == 204
    assert gallery(product) == [(first["id"], 0, True)]
    assert staff_client.delete(image_url(product, first["id"])).status_code == 204
    assert gallery(product) == []
    assert staff_client.delete(image_url(product, first["id"])).status_code == 404
    next_image = upload(staff_client, product)
    assert next_image["order"] == 0 and next_image["is_main"] is True
    product.refresh_from_db()
    assert product.is_published is False and product.stock_quantity == 100


@pytest.mark.parametrize(
    "data,field",
    [
        ({"order": -1}, "order"),
        ({"order": 2}, "order"),
        ({"order": 0.5}, "order"),
        ({"order": "0"}, "order"),
        ({"order": True}, "order"),
        ({"is_main": False}, "is_main"),
        ({"is_mock": True}, "is_mock"),
        ({"image": "replace.png"}, "image"),
        ({"id": 22}, "id"),
        ({"product": "other"}, "product"),
    ],
)
def test_invalid_patch_is_field_error_and_has_no_changes(
    staff_client, products, data, field
):
    product = products["cheap"]
    first = upload(staff_client, product)
    before = gallery(product)
    response = staff_client.patch(image_url(product, first["id"]), data, format="json")
    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"
    assert field in response.json()["errors"]
    assert gallery(product) == before


@pytest.mark.parametrize("case", ["bad", "gif", "large", "missing", "extra", "two"])
def test_invalid_upload_is_rejected_without_file_or_row(
    staff_client, products, tmp_path, case
):
    data = {"image": image_file()}
    if case == "bad":
        data["image"] = SimpleUploadedFile("photo.png", b"<svg>not an image</svg>")
    elif case == "gif":
        data["image"] = image_file(image_format="GIF")
    elif case == "large":
        data["image"] = SimpleUploadedFile("large.png", b"x" * (MAX_IMAGE_BYTES + 1))
    elif case == "missing":
        data = {}
    elif case == "extra":
        data["is_main"] = True
    elif case == "two":
        data["image"] = [image_file(), image_file()]
    response = staff_client.post(
        upload_url(products["cheap"]), data, format="multipart"
    )
    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"
    assert not ProductImage.objects.exists()
    assert list(tmp_path.rglob("*")) == []


def test_limit_includes_exactly_four_mib(staff_client, products):
    image = image_file()
    content = image.read()
    # PNG permits trailing data; the exact content length must be accepted.
    data = SimpleUploadedFile(
        "edge.png", content + b"\0" * (MAX_IMAGE_BYTES - len(content))
    )
    response = staff_client.post(
        upload_url(products["cheap"]), {"image": data}, format="multipart"
    )
    assert response.status_code == 201, response.json()
    stored = ProductImage.objects.get(pk=response.json()["id"])
    assert stored.image.size == MAX_IMAGE_BYTES


def test_demo_gallery_requires_existing_owner_conversion(staff_client, products):
    product = products["cheap"]
    first = upload(staff_client, product)
    Product.objects.filter(pk=product.pk).update(origin=Product.Origin.DEMO)
    before = gallery(product)
    responses = [
        staff_client.post(
            upload_url(product), {"image": image_file()}, format="multipart"
        ),
        staff_client.patch(
            image_url(product, first["id"]), {"order": 0}, format="json"
        ),
        staff_client.delete(image_url(product, first["id"])),
    ]
    for response in responses:
        assert response.status_code == 400
        assert "save_as_owner" in response.json()["errors"]
    assert gallery(product) == before
    converted = staff_client.patch(
        reverse("manage-product-detail", args=[product.pk]),
        {"save_as_owner": True},
        format="json",
    )
    assert converted.status_code == 200
    assert converted.json()["images"][0]["id"] == first["id"]
    assert upload(staff_client, product)["order"] == 1


def test_missing_and_cross_product_ids(staff_client, products):
    product, other = products["cheap"], products["pricey"]
    first = upload(staff_client, product)
    for method, data in [("patch", {"is_main": True}), ("delete", None)]:
        response = getattr(staff_client, method)(
            image_url(other, first["id"]), data, format="json"
        )
        assert response.status_code == 404
    missing = reverse("manage-product-image-upload", args=[uuid4()])
    assert (
        staff_client.post(
            missing, {"image": image_file()}, format="multipart"
        ).status_code
        == 404
    )
    assert gallery(product) == [(first["id"], 0, True)]


def test_converted_demo_keeps_mocks_but_prefers_real_main(staff_client, products):
    product = products["cheap"]
    mock = ProductImage.objects.create(
        product=product, image=image_file(), order=7, is_main=True, is_mock=True
    )
    real = upload(staff_client, product)
    assert real["is_main"] is True
    assert gallery(product) == [(mock.pk, 0, False), (real["id"], 1, True)]
    denied = staff_client.patch(
        image_url(product, mock.pk), {"is_main": True}, format="json"
    )
    assert denied.status_code == 400 and "is_main" in denied.json()["errors"]
    public = APIClient().get(reverse("product-detail", args=[product.slug])).json()
    assert public["image_url"] == real["url"]
    assert len(public["images"]) == 1
    assert public["images"][0]["is_main"] is True
    assert staff_client.delete(image_url(product, real["id"])).status_code == 204
    assert gallery(product) == [(mock.pk, 0, True)]
    public = APIClient().get(reverse("product-detail", args=[product.slug])).json()
    assert public["image_url"] is None and public["images"] == []
    assert mock.image.storage.exists(mock.image.name)
    denied = staff_client.patch(
        image_url(product, mock.pk), {"is_main": True}, format="json"
    )
    assert denied.status_code == 400 and "is_main" in denied.json()["errors"]


def test_delete_failure_preserves_row_main_and_file(
    staff_client, products, monkeypatch
):
    product = products["cheap"]
    first = upload(staff_client, product)
    image = ProductImage.objects.get(pk=first["id"])
    before = gallery(product)

    def fail(*args, **kwargs):
        raise PermissionError("private provider payload must not escape")

    monkeypatch.setattr(image.image.storage, "delete", fail)
    response = staff_client.delete(image_url(product, image.pk))
    assert response.status_code == 503
    assert response.json()["code"] == "image_storage_unavailable"
    assert "private" not in response.content.decode()
    assert gallery(product) == before
    assert image.image.storage.exists(image.image.name)


def test_upload_storage_failure_does_not_create_row(
    staff_client, products, monkeypatch
):
    storage = ProductImage._meta.get_field("image").storage

    def fail(*args, **kwargs):
        raise PermissionError("private provider payload must not escape")

    monkeypatch.setattr(storage, "save", fail)
    response = staff_client.post(
        upload_url(products["cheap"]), {"image": image_file()}, format="multipart"
    )
    assert response.status_code == 503
    assert response.json()["code"] == "image_storage_unavailable"
    assert "private" not in response.content.decode()
    assert not ProductImage.objects.exists()


def test_missing_file_does_not_prevent_removing_image(staff_client, products):
    product = products["cheap"]
    data = upload(staff_client, product)
    image = ProductImage.objects.get(pk=data["id"])
    image.image.storage.delete(image.image.name)
    assert staff_client.delete(image_url(product, image.pk)).status_code == 204
    assert not ProductImage.objects.exists()


def test_legacy_missing_main_and_gaps_are_normalized(staff_client, products):
    product = products["cheap"]
    images = [
        ProductImage.objects.create(product=product, image=image_file(), order=7)
        for _ in range(2)
    ]
    response = staff_client.patch(
        image_url(product, images[1].pk), {"order": 0}, format="json"
    )
    assert response.status_code == 200
    assert gallery(product) == [(images[1].pk, 0, True), (images[0].pk, 1, False)]


def test_failed_db_insert_cleans_successfully_uploaded_file(
    staff_client, products, monkeypatch, tmp_path
):
    def fail(*args, **kwargs):
        raise RuntimeError("synthetic insert failure")

    monkeypatch.setattr(ProductImage, "save", fail)
    with pytest.raises(RuntimeError, match="synthetic insert failure"):
        staff_client.post(
            upload_url(products["cheap"]), {"image": image_file()}, format="multipart"
        )
    assert not ProductImage.objects.exists()
    assert not [path for path in tmp_path.rglob("*") if path.is_file()]


def test_api_uses_selected_blob_storage(staff_client, products, monkeypatch):
    from types import SimpleNamespace

    storage = BlobStorage(
        store_id="store_Coffee43test",
        public_base_url="https://coffee43test.public.blob.vercel-storage.com",
    )
    objects = {}
    seen_types = []

    def provider(operation, name, *args, **kwargs):
        if operation == "head_blob":
            if name not in objects:
                raise FileNotFoundError
            return SimpleNamespace(size=len(objects[name]))
        if operation == "put_blob":
            objects[name] = args[0].read()
            seen_types.append(kwargs["content_type"])
            return SimpleNamespace(pathname=name, url=storage.url(name))
        assert operation == "delete_blob"
        objects.pop(name, None)

    monkeypatch.setattr(storage, "_call", provider)
    monkeypatch.setattr(ProductImage._meta.get_field("image"), "storage", storage)
    product = products["cheap"]
    data = upload(staff_client, product, image_format="JPEG", content_type="text/plain")
    assert data["url"].startswith(storage.public_base_url + "/products/")
    assert seen_types == ["image/jpeg"] and len(objects) == 1
    assert staff_client.delete(image_url(product, data["id"])).status_code == 204
    assert objects == {} and not ProductImage.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_concurrent_uploads_and_main_changes_serialize(products):
    product = products["cheap"]

    def create():
        serializer = ProductImageUploadSerializer(data={"image": image_file()})
        serializer.is_valid(raise_exception=True)
        return upload_product_image(
            product_id=product.pk, uploaded_file=serializer.validated_data["image"]
        )

    first, second = race(create, create)
    assert len(gallery(product)) == 2
    assert [item[1] for item in gallery(product)] == [0, 1]
    assert product.images.filter(is_main=True).count() == 1
    race(
        lambda: patch_product_image(
            product_id=product.pk, image_id=first.pk, data={"is_main": True, "order": 1}
        ),
        lambda: patch_product_image(
            product_id=product.pk,
            image_id=second.pk,
            data={"is_main": True, "order": 1},
        ),
    )
    assert [item[1] for item in gallery(product)] == [0, 1]
    assert product.images.filter(is_main=True).count() == 1
    main_id = product.images.get(is_main=True).pk
    race(
        lambda: delete_product_image(product_id=product.pk, image_id=main_id),
        create,
    )
    assert len(gallery(product)) == 2
    assert [item[1] for item in gallery(product)] == [0, 1]
    assert product.images.filter(is_main=True).count() == 1

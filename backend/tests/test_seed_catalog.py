"""Explicit demo seed must never reset existing store-owner data."""

from decimal import Decimal
from pathlib import Path

import pytest
from django.core.management import call_command

from apps.catalog.management.commands.seed_catalog import COFFEE_PRODUCTS
from apps.catalog.models import Category, Product, ProductImage


@pytest.fixture(autouse=True)
def local_media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


@pytest.mark.django_db
@pytest.mark.parametrize("has_image", [False, True])
def test_seed_preserves_owner_product_and_gallery(has_image, monkeypatch):
    category = Category.objects.create(
        name="Авторская категория", slug="owner-category"
    )
    product = Product.objects.create(
        slug=COFFEE_PRODUCTS[0]["slug"],
        name="Кофе владельца",
        short_description="Своё описание",
        description="Подробности владельца",
        category=category,
        price=Decimal("1234.00"),
        old_price=Decimal("1500.00"),
        in_stock=False,
        attributes={},
    )
    if has_image:
        image = ProductImage.objects.create(
            product=product,
            image="products/owner-missing-file.png",
            order=7,
            is_main=True,
        )

        original_exists = image.image.storage.exists

        def unexpected_exists(name):
            if name == image.image.name:
                pytest.fail("Seed must not inspect or repair the owner's stored image")
            return original_exists(name)

        monkeypatch.setattr(image.image.storage, "exists", unexpected_exists)
    before = Product.objects.filter(pk=product.pk).values().get()
    gallery = list(product.images.values())
    call_command("seed_catalog")
    call_command("seed_catalog")
    assert Product.objects.filter(pk=product.pk).values().get() == before
    assert list(product.images.values()) == gallery
    assert Product.objects.count() == 18
    assert ProductImage.objects.count() == (18 if has_image else 17)


@pytest.mark.django_db
def test_repeated_seed_preserves_edited_demo_and_all_objects():
    call_command("seed_catalog")
    product = Product.objects.get(slug=COFFEE_PRODUCTS[0]["slug"])
    product.name = "Редактированный товар"
    product.price = Decimal("123.00")
    product.save()
    products = list(Product.objects.order_by("pk").values())
    images = list(ProductImage.objects.order_by("pk").values())
    image_directory = Path(product.images.first().image.path).parent
    files = sorted(path.name for path in image_directory.iterdir())
    call_command("seed_catalog")
    assert list(Product.objects.order_by("pk").values()) == products
    assert list(ProductImage.objects.order_by("pk").values()) == images
    assert sorted(path.name for path in image_directory.iterdir()) == files

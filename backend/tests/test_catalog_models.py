"""Catalog model tests for COFFEE-19.

Confirms coffee and coffee machines share one Product table and that
attributes only accept the fixed typed key set per category.
"""

from decimal import Decimal
from io import BytesIO

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from PIL import Image

from apps.catalog.models import Category, Product, ProductImage


@pytest.fixture
def coffee_category(db) -> Category:
    return Category.objects.create(name="Кофе", slug="coffee")


@pytest.fixture
def machines_category(db) -> Category:
    return Category.objects.create(name="Кофемашины", slug="machines")


def _png_upload(name: str = "test.png") -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), color=(200, 100, 50)).save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


@pytest.mark.django_db
def test_coffee_and_machines_share_product_table(
    coffee_category: Category,
    machines_category: Category,
) -> None:
    """Both product types live in Product with different category_id."""
    coffee_product = Product.objects.create(
        name="Эфиопия Йиргачеффе",
        slug="ethiopia-yirgacheffe",
        category=coffee_category,
        short_description="Ягоды и жасмин, светлая обжарка",
        description="Подробное описание для страницы товара",
        price=Decimal("890.00"),
        attributes={
            "country": "Эфиопия",
            "roast": 2,
            "intensity": 7,
            "bitterness": 4,
            "acidity": 5,
            "density": 5,
        },
    )
    machine_product = Product.objects.create(
        name="Рожковая Barista Pro",
        slug="barista-pro",
        category=machines_category,
        short_description="Домашняя рожковая, 15 бар",
        description="Подробное описание кофемашины",
        price=Decimal("24990.00"),
        old_price=Decimal("27990.00"),
        attributes={
            "dimensions": "32×25×40 см",
            "pressure_bar": 15,
            "power_w": 1450,
            "capsule_format": "не требуется",
            "manufacturer_country": "Италия",
        },
    )

    assert Product.objects.count() == 2
    assert coffee_product.category_id != machine_product.category_id
    assert coffee_product._meta.db_table == machine_product._meta.db_table
    assert coffee_product.short_description == "Ягоды и жасмин, светлая обжарка"
    assert coffee_product.attributes["country"] == "Эфиопия"
    assert coffee_product.attributes["roast"] == 2
    assert machine_product.attributes["power_w"] == 1450
    assert coffee_product.in_stock is True


@pytest.mark.django_db
def test_coffee_rejects_unknown_attribute_key(
    coffee_category: Category,
) -> None:
    """Free-form attribute keys are not allowed."""
    product = Product(
        name="Тест",
        slug="test-coffee",
        category=coffee_category,
        short_description="Кратко",
        price=Decimal("100.00"),
        attributes={"country": "Бразилия", "taste_notes": "шоколад"},
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "attributes" in exc_info.value.message_dict
    assert "taste_notes" in str(exc_info.value)


@pytest.mark.django_db
def test_machine_rejects_coffee_attribute_key(
    machines_category: Category,
) -> None:
    """Coffee-only keys must not appear on machines."""
    product = Product(
        name="Тест машина",
        slug="test-machine",
        category=machines_category,
        short_description="Кратко",
        price=Decimal("10000.00"),
        attributes={"roast": 3},
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "attributes" in exc_info.value.message_dict


@pytest.mark.django_db
def test_empty_attributes_allowed(coffee_category: Category) -> None:
    """Attribute keys are optional; short_description and price are enough."""
    product = Product.objects.create(
        name="Минимум",
        slug="minimum-coffee",
        category=coffee_category,
        short_description="Минимальный набор полей",
        price=Decimal("500.00"),
    )

    assert product.attributes == {}


@pytest.mark.django_db
def test_short_description_required(coffee_category: Category) -> None:
    """short_description cannot be blank."""
    product = Product(
        name="Без тизера",
        slug="no-teaser",
        category=coffee_category,
        short_description="",
        price=Decimal("100.00"),
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "short_description" in exc_info.value.message_dict


@pytest.mark.django_db
def test_coffee_rejects_scale_out_of_range(
    coffee_category: Category,
) -> None:
    """Taste scales must stay within documented bounds."""
    product = Product(
        name="Слишком кислый",
        slug="too-acidic",
        category=coffee_category,
        short_description="Кратко",
        price=Decimal("100.00"),
        attributes={"acidity": 6},
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "acidity" in str(exc_info.value)


@pytest.mark.django_db
def test_coffee_rejects_intensity_out_of_range(
    coffee_category: Category,
) -> None:
    """Intensity must be 0–13."""
    product = Product(
        name="Слишком интенсивный",
        slug="too-intense",
        category=coffee_category,
        short_description="Кратко",
        price=Decimal("100.00"),
        attributes={"intensity": 14},
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "intensity" in str(exc_info.value)


@pytest.mark.django_db
def test_coffee_rejects_string_roast(coffee_category: Category) -> None:
    """Roast is a 0–5 scale, not a free-text label."""
    product = Product(
        name="Строковая обжарка",
        slug="string-roast",
        category=coffee_category,
        short_description="Кратко",
        price=Decimal("100.00"),
        attributes={"roast": "светлая"},
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "roast" in str(exc_info.value)


@pytest.mark.django_db
def test_machine_rejects_negative_power(
    machines_category: Category,
) -> None:
    """power_w must be a non-negative integer."""
    product = Product(
        name="Слабая машина",
        slug="negative-power",
        category=machines_category,
        short_description="Кратко",
        price=Decimal("10000.00"),
        attributes={"power_w": -1},
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "power_w" in str(exc_info.value)


@pytest.mark.django_db
def test_machine_rejects_negative_pressure(
    machines_category: Category,
) -> None:
    """pressure_bar must be a non-negative integer."""
    product = Product(
        name="Отрицательное давление",
        slug="negative-pressure",
        category=machines_category,
        short_description="Кратко",
        price=Decimal("10000.00"),
        attributes={"pressure_bar": -5},
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "pressure_bar" in str(exc_info.value)


@pytest.mark.django_db
def test_machine_rejects_bool_as_power(
    machines_category: Category,
) -> None:
    """bool must not pass as int (bool subclasses int in Python)."""
    product = Product(
        name="Bool мощность",
        slug="bool-power",
        category=machines_category,
        short_description="Кратко",
        price=Decimal("10000.00"),
        attributes={"power_w": True},
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "power_w" in str(exc_info.value)


@pytest.mark.django_db
def test_unknown_category_rejects_non_empty_attributes(db) -> None:
    """Unknown category slug may only have empty attributes."""
    other = Category.objects.create(name="Чай", slug="tea")
    product = Product(
        name="Чай",
        slug="tea-product",
        category=other,
        short_description="Кратко",
        price=Decimal("300.00"),
        attributes={"country": "Китай"},
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "attributes" in exc_info.value.message_dict


@pytest.mark.django_db
def test_rejects_negative_price(coffee_category: Category) -> None:
    """price must be >= 0."""
    product = Product(
        name="Отрицательная цена",
        slug="negative-price",
        category=coffee_category,
        short_description="Кратко",
        price=Decimal("-1.00"),
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "price" in exc_info.value.message_dict


@pytest.mark.django_db
def test_rejects_old_price_not_greater_than_price(
    coffee_category: Category,
) -> None:
    """old_price, when set, must be strictly greater than price."""
    product = Product(
        name="Плохая скидка",
        slug="bad-discount",
        category=coffee_category,
        short_description="Кратко",
        price=Decimal("100.00"),
        old_price=Decimal("100.00"),
    )

    with pytest.raises(ValidationError) as exc_info:
        product.save()

    assert "old_price" in exc_info.value.message_dict


@pytest.mark.django_db
def test_only_one_main_image_per_product(coffee_category: Category) -> None:
    """At most one ProductImage with is_main=True per product."""
    product = Product.objects.create(
        name="С картинками",
        slug="with-images",
        category=coffee_category,
        short_description="Кратко",
        price=Decimal("500.00"),
    )
    ProductImage.objects.create(
        product=product,
        image=_png_upload("main.png"),
        order=0,
        is_main=True,
    )

    second = ProductImage(
        product=product,
        image=_png_upload("second.png"),
        order=1,
        is_main=True,
    )
    with pytest.raises(ValidationError) as exc_info:
        second.save()

    assert "is_main" in exc_info.value.message_dict

    # Bypass model.save() to assert the DB constraint as well.
    with pytest.raises(IntegrityError):
        ProductImage.objects.bulk_create(
            [
                ProductImage(
                    product=product,
                    image=_png_upload("bulk.png"),
                    order=2,
                    is_main=True,
                ),
            ],
        )

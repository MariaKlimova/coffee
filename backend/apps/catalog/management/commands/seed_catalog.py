"""Seed catalog categories, products, and placeholder images."""

from __future__ import annotations

from decimal import Decimal
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.db import transaction
from PIL import Image

from apps.catalog.models import Category, Product, ProductImage

COFFEE_PRODUCTS: list[dict] = [
    {
        "name": "Эфиопия Йиргачеффе",
        "slug": "ethiopia-yirgacheffe",
        "short_description": "Светлая обжарка с ягодной кислотностью",
        "description": "Мытый процесс, цветочный аромат и чистая чашка.",
        "price": Decimal("890.00"),
        "old_price": Decimal("990.00"),
        "attributes": {
            "country": "Эфиопия",
            "intensity": 7,
            "bitterness": 2,
            "acidity": 5,
            "roast": 2,
            "density": 3,
        },
    },
    {
        "name": "Колумбия Уила",
        "slug": "colombia-huila",
        "short_description": "Сбалансированный профиль с какао",
        "description": "Подходит для эспрессо и молочных напитков.",
        "price": Decimal("820.00"),
        "attributes": {
            "country": "Колумбия",
            "intensity": 8,
            "bitterness": 3,
            "acidity": 3,
            "roast": 3,
            "density": 4,
        },
    },
    {
        "name": "Бразилия Серрадо",
        "slug": "brazil-cerrado",
        "short_description": "Плотный боди, ореховые ноты",
        "description": "Классика для домашнего эспрессо.",
        "price": Decimal("690.00"),
        "attributes": {
            "country": "Бразилия",
            "intensity": 9,
            "bitterness": 4,
            "acidity": 2,
            "roast": 4,
            "density": 5,
        },
    },
    {
        "name": "Кения АА",
        "slug": "kenya-aa",
        "short_description": "Яркая кислинка и чёрная смородина",
        "description": "Лучше раскрывается в пуровере и V60.",
        "price": Decimal("980.00"),
        "old_price": Decimal("1100.00"),
        "attributes": {
            "country": "Кения",
            "intensity": 8,
            "bitterness": 2,
            "acidity": 5,
            "roast": 2,
            "density": 3,
        },
    },
    {
        "name": "Гватемала Антигуа",
        "slug": "guatemala-antigua",
        "short_description": "Шоколад и специи",
        "description": "Универсальный зерно для фильтра и эспрессо.",
        "price": Decimal("850.00"),
        "attributes": {
            "country": "Гватемала",
            "intensity": 7,
            "bitterness": 3,
            "acidity": 3,
            "roast": 3,
            "density": 4,
        },
    },
    {
        "name": "Руанда Бурунди Бленд",
        "slug": "rwanda-blend",
        "short_description": "Сладкий бленд для молочных напитков",
        "description": "Мягкая кислотность и карамельная сладость.",
        "price": Decimal("760.00"),
        "attributes": {
            "country": "Руанда",
            "intensity": 6,
            "bitterness": 2,
            "acidity": 3,
            "roast": 3,
            "density": 3,
        },
    },
    {
        "name": "Суматра Манделинг",
        "slug": "sumatra-mandheling",
        "short_description": "Землистый профиль, низкая кислотность",
        "description": "Плотная чашка для любителей тёмной обжарки.",
        "price": Decimal("790.00"),
        "attributes": {
            "country": "Индонезия",
            "intensity": 10,
            "bitterness": 5,
            "acidity": 1,
            "roast": 5,
            "density": 5,
        },
    },
    {
        "name": "Перу Чичайо",
        "slug": "peru-chiclayo",
        "short_description": "Мягкий и ореховый",
        "description": "Хороший старт для ежедневного заваривания.",
        "price": Decimal("720.00"),
        "attributes": {
            "country": "Перу",
            "intensity": 5,
            "bitterness": 2,
            "acidity": 2,
            "roast": 3,
            "density": 3,
        },
    },
    {
        "name": "Коста-Рика Тарразу",
        "slug": "costa-rica-tarrazu",
        "short_description": "Чистая чашка, цитрус",
        "description": "Мытый процесс, отличная ясность вкуса.",
        "price": Decimal("910.00"),
        "in_stock": False,
        "attributes": {
            "country": "Коста-Рика",
            "intensity": 6,
            "bitterness": 2,
            "acidity": 4,
            "roast": 2,
            "density": 3,
        },
    },
]

MACHINE_PRODUCTS: list[dict] = [
    {
        "name": "Barista Pro 15",
        "slug": "barista-pro-15",
        "short_description": "Рожковая для дома, 15 бар",
        "description": "Компактная рожковая машина с паровым краном.",
        "price": Decimal("24990.00"),
        "old_price": Decimal("27990.00"),
        "attributes": {
            "dimensions": "32×25×40 см",
            "pressure_bar": 15,
            "power_w": 1450,
            "capsule_format": "не требуется",
            "manufacturer_country": "Италия",
        },
    },
    {
        "name": "Capsule Mini",
        "slug": "capsule-mini",
        "short_description": "Капсульная, быстрый старт",
        "description": "Для небольших кухонь и офиса.",
        "price": Decimal("8990.00"),
        "attributes": {
            "dimensions": "12×40×25 см",
            "pressure_bar": 19,
            "power_w": 1200,
            "capsule_format": "Nespresso",
            "manufacturer_country": "Швейцария",
        },
    },
    {
        "name": "GrainMaster 300",
        "slug": "grainmaster-300",
        "short_description": "Автомат от зерна до чашки",
        "description": "Встроенная кофемолка и регулировка крепости.",
        "price": Decimal("45990.00"),
        "attributes": {
            "dimensions": "28×45×40 см",
            "pressure_bar": 15,
            "power_w": 1450,
            "capsule_format": "не требуется",
            "manufacturer_country": "Германия",
        },
    },
    {
        "name": "Office Capsule Duo",
        "slug": "office-capsule-duo",
        "short_description": "Два напитка подряд без ожидания",
        "description": "Удобна для небольшого офиса.",
        "price": Decimal("12990.00"),
        "old_price": Decimal("14990.00"),
        "attributes": {
            "dimensions": "18×35×28 см",
            "pressure_bar": 19,
            "power_w": 1300,
            "capsule_format": "Dolce Gusto",
            "manufacturer_country": "Китай",
        },
    },
    {
        "name": "Manual Lever Classic",
        "slug": "manual-lever-classic",
        "short_description": "Рычажная машина для энтузиастов",
        "description": "Полный контроль экстракции.",
        "price": Decimal("38990.00"),
        "attributes": {
            "dimensions": "30×35×42 см",
            "pressure_bar": 9,
            "power_w": 1600,
            "capsule_format": "не требуется",
            "manufacturer_country": "Италия",
        },
    },
    {
        "name": "Travel Capsule Go",
        "slug": "travel-capsule-go",
        "short_description": "Компактная капсульная в дорогу",
        "description": "Работает от розетки, быстрый прогрев.",
        "price": Decimal("5990.00"),
        "attributes": {
            "dimensions": "10×25×18 см",
            "pressure_bar": 15,
            "power_w": 800,
            "capsule_format": "Nespresso",
            "manufacturer_country": "Китай",
        },
    },
    {
        "name": "CafeHouse Superauto",
        "slug": "cafehouse-superauto",
        "short_description": "Суперавтомат с капучинатором",
        "description": "Один клик — латте или капучино.",
        "price": Decimal("62990.00"),
        "attributes": {
            "dimensions": "30×48×40 см",
            "pressure_bar": 15,
            "power_w": 1500,
            "capsule_format": "не требуется",
            "manufacturer_country": "Швейцария",
        },
    },
    {
        "name": "BrewPod Home",
        "slug": "brewpod-home",
        "short_description": "Капсульная для ежедневного кофе",
        "description": "Простая панель и тихая работа.",
        "price": Decimal("7490.00"),
        "in_stock": False,
        "attributes": {
            "dimensions": "14×35×24 см",
            "pressure_bar": 19,
            "power_w": 1260,
            "capsule_format": "Nespresso",
            "manufacturer_country": "Венгрия",
        },
    },
    {
        "name": "SteamLine Plus",
        "slug": "steamline-plus",
        "short_description": "Рожковая с мощным паром",
        "description": "Хорошо взбивает молоко для флэта.",
        "price": Decimal("19990.00"),
        "attributes": {
            "dimensions": "28×32×38 см",
            "pressure_bar": 15,
            "power_w": 1350,
            "capsule_format": "не требуется",
            "manufacturer_country": "Китай",
        },
    },
]


def _placeholder_png(color: tuple[int, int, int], name: str) -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new("RGB", (320, 320), color=color).save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class Command(BaseCommand):
    """Create demo catalog data for local/frontend development."""

    help = "Seed catalog categories, products, and placeholder images"

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        coffee, _ = Category.objects.get_or_create(
            slug="coffee",
            defaults={"name": "Кофе"},
        )
        machines, _ = Category.objects.get_or_create(
            slug="machines",
            defaults={"name": "Кофемашины"},
        )

        created = 0
        created += self._seed_products(coffee, COFFEE_PRODUCTS, (140, 90, 50))
        created += self._seed_products(machines, MACHINE_PRODUCTS, (80, 90, 110))

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed complete: {created} products created "
                f"(categories: {coffee.slug}, {machines.slug})."
            )
        )

    def _seed_products(
        self,
        category: Category,
        items: list[dict],
        color: tuple[int, int, int],
    ) -> int:
        created = 0
        for item in items:
            product, was_created = Product.objects.update_or_create(
                slug=item["slug"],
                defaults={
                    "name": item["name"],
                    "category": category,
                    "short_description": item["short_description"],
                    "description": item.get("description", ""),
                    "price": item["price"],
                    "old_price": item.get("old_price"),
                    "in_stock": item.get("in_stock", True),
                    "attributes": item.get("attributes", {}),
                },
            )
            if was_created or not product.images.exists():
                product.images.all().delete()
                ProductImage.objects.create(
                    product=product,
                    image=_placeholder_png(color, f"{product.slug}.png"),
                    order=0,
                    is_main=True,
                )
            if was_created:
                created += 1
        return created

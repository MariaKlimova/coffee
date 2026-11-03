"""Catalog models: Category, Product, ProductImage.

Coffee and coffee machines share one Product table; they differ by
category and a fixed set of keys in attributes (see attributes.py).
"""

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from apps.catalog.attributes import validate_product_attributes


class Category(models.Model):
    """
    Product category for the storefront (e.g. coffee, machines).

    Not hardcoded as choices — new categories can be added as rows later
    without changing the schema architecture.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)

    class Meta:
        verbose_name = "category"
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    """
    A sellable item — coffee bag or coffee machine.

    Both live in this table. Category-specific traits go into `attributes`
    with a closed key set per category (validated in clean()).
    """

    class Origin(models.TextChoices):
        OWNER = "owner", "Owner"
        DEMO = "demo", "Demo"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    short_description = models.CharField(
        max_length=300,
        help_text="Required teaser shown on cards and product page.",
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Optional full description on the product page.",
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    old_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text="Previous price for discount display; leave empty if none.",
    )
    # Never infer a count from the former boolean availability flag.
    stock_quantity = models.PositiveIntegerField(default=0, editable=False)
    reserved_quantity = models.PositiveIntegerField(default=0, editable=False)
    is_published = models.BooleanField(default=True)
    origin = models.CharField(
        max_length=10, choices=Origin.choices, default=Origin.OWNER
    )
    demo_source = models.CharField(
        max_length=100, blank=True, default="", editable=False
    )
    attributes = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Coffee: country (str); intensity 0–13; "
            "bitterness/acidity/roast/density 0–5. "
            "Machines: dimensions, capsule_format, "
            "manufacturer_country (str); "
            "pressure_bar (int, бар ≥ 0); power_w (int, Вт ≥ 0). "
            "All keys optional."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "product"
        verbose_name_plural = "products"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category", "is_published"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(stock_quantity__gte=models.F("reserved_quantity")),
                name="catalog_stock_covers_reservations",
            ),
        ]

    @property
    def available_quantity(self) -> int:
        return self.stock_quantity - self.reserved_quantity

    @property
    def in_stock(self) -> bool:
        return self.available_quantity > 0

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        super().clean()
        if self.old_price is not None and self.price is not None:
            if self.old_price <= self.price:
                raise ValidationError(
                    {
                        "old_price": (
                            "Old price must be greater than the current price."
                        ),
                    },
                )

        if self.category_id is None:
            return
        try:
            category_slug = self.category.slug
        except Category.DoesNotExist as exc:
            raise ValidationError({"category": "Invalid category."}) from exc

        validate_product_attributes(
            category_slug=category_slug,
            attributes=self.attributes,
        )

    def save(self, *args, **kwargs):
        # Catalog edits must not overwrite counters loaded before a concurrent
        # checkout. Only inventory services update counters, via locked UPDATE.
        counters = {"stock_quantity", "reserved_quantity"}
        if not self._state.adding:
            update_fields = kwargs.get("update_fields")
            if update_fields is not None and counters.intersection(update_fields):
                raise ValidationError("Use the inventory adjustment service.")
            if update_fields is None:
                kwargs["update_fields"] = [
                    field.name
                    for field in self._meta.concrete_fields
                    if not field.primary_key and field.name not in counters
                ]
            self.full_clean(exclude=counters)
        else:
            self.full_clean()
        super().save(*args, **kwargs)


class ProductImage(models.Model):
    """Gallery image for a product; one may be marked as the main cover."""

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = models.ImageField(upload_to="products/%Y/%m/")
    order = models.PositiveIntegerField(default=0)
    is_main = models.BooleanField(default=False)
    is_mock = models.BooleanField(default=False)

    class Meta:
        verbose_name = "product image"
        verbose_name_plural = "product images"
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["product"],
                condition=models.Q(is_main=True),
                name="catalog_productimage_one_main_per_product",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product.name} image #{self.order}"

    def clean(self) -> None:
        super().clean()
        if not self.is_main or self.product_id is None:
            return
        qs = ProductImage.objects.filter(
            product_id=self.product_id,
            is_main=True,
        )
        if self.pk is not None:
            qs = qs.exclude(pk=self.pk)
        if qs.exists():
            raise ValidationError(
                {"is_main": "Only one main image is allowed per product."},
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class StockAdjustment(models.Model):
    """Append-only staff adjustment audit; stock changes go through one service."""

    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    before_quantity = models.PositiveIntegerField()
    after_quantity = models.PositiveIntegerField()
    reason = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]


class CatalogState(models.Model):
    """One persisted switch; deployment and demo seeding never reset it."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    demo_enabled = models.BooleanField(default=True)
    switched_at = models.DateTimeField(null=True, blank=True)
    switched_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(id=1), name="catalog_state_singleton"
            )
        ]

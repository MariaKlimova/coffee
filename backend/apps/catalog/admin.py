"""Django admin for catalog models."""

from django.contrib import admin

from apps.catalog.models import Category, Product, ProductImage


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """List and edit storefront categories."""

    list_display = ("name", "slug", "id")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


class ProductImageInline(admin.TabularInline):
    """Edit product gallery images on the product change page."""

    model = ProductImage
    extra = 1
    fields = ("image", "order", "is_main")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    """List, filter, and edit products with inline images."""

    list_display = (
        "name",
        "short_description",
        "category",
        "price",
        "in_stock",
        "created_at",
    )
    list_filter = ("category", "in_stock")
    search_fields = ("name", "slug", "short_description")
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("created_at", "updated_at")
    inlines = (ProductImageInline,)

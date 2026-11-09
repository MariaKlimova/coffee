"""Serialized gallery changes, with explicit storage failure boundaries."""

import logging

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from apps.catalog.models import Product, ProductImage

logger = logging.getLogger(__name__)


class ImageStorageUnavailable(APIException):
    status_code = 503
    default_detail = "Image storage is temporarily unavailable. Try again."
    default_code = "image_storage_unavailable"


def _storage_call(operation, *args, **kwargs):
    try:
        return operation(*args, **kwargs)
    except Exception:
        # Storage SDK errors may contain credentials or provider response bodies.
        # Restrict this boundary to storage calls; DB/programming errors propagate.
        raise ImageStorageUnavailable() from None


def _lock_product(product_id):
    product = get_object_or_404(Product.objects.select_for_update(), pk=product_id)
    if product.origin == Product.Origin.DEMO:
        raise ValidationError(
            {"save_as_owner": ["Save this demo product as your own first."]}
        )
    return product


def _normalize(product, images, main_id=None):
    if images:
        candidates = [image for image in images if not image.is_mock] or images
        chosen = main_id or next(
            (image.pk for image in candidates if image.is_main), candidates[0].pk
        )
        ProductImage.objects.filter(product=product, is_main=True).exclude(
            pk=chosen
        ).update(is_main=False)
        for order, image in enumerate(images):
            image.order = order
            image.is_main = image.pk == chosen
        ProductImage.objects.bulk_update(images, ["order", "is_main"])
    Product.objects.filter(pk=product.pk).update(updated_at=timezone.now())


def upload_product_image(*, product_id, uploaded_file):
    saved_file = None
    try:
        with transaction.atomic():
            product = _lock_product(product_id)
            images = list(product.images.all())
            image = ProductImage(product=product, order=len(images))
            _storage_call(
                image.image.save, uploaded_file.name, uploaded_file, save=False
            )
            saved_file = (image.image.storage, image.image.name)
            image.save()
            _normalize(product, [*images, image])
        return image
    except Exception:
        # A completed upload must not leak if inserting its DB row fails.
        # A provider timeout before acknowledging save can still need provider-side
        # reconciliation; no successful API response or DB row is fabricated.
        if saved_file is not None:
            storage, name = saved_file
            try:
                storage.delete(name)
            except Exception:
                logger.error("Could not clean up an uncommitted catalog image.")
        raise


@transaction.atomic
def patch_product_image(*, product_id, image_id, data):
    product = _lock_product(product_id)
    image = get_object_or_404(ProductImage, product=product, pk=image_id)
    images = list(product.images.all())
    if "order" in data:
        if data["order"] >= len(images):
            raise ValidationError({"order": ["Choose an existing gallery position."]})
        images = [item for item in images if item.pk != image.pk]
        images.insert(data["order"], image)
    if data.get("is_main") is False and image.is_main:
        raise ValidationError({"is_main": ["Choose another main image first."]})
    if data.get("is_main") and image.is_mock:
        raise ValidationError(
            {"is_main": ["Choose an uploaded image as the main image."]}
        )
    _normalize(product, images, image.pk if data.get("is_main") else None)
    return next(item for item in images if item.pk == image.pk)


@transaction.atomic
def delete_product_image(*, product_id, image_id):
    product = _lock_product(product_id)
    image = get_object_or_404(ProductImage, product=product, pk=image_id)
    # Delete storage first: on a storage error the transaction retains the row and
    # main/order state for retry. Object stores and PostgreSQL are not a shared
    # transaction; a DB commit failure after a successful delete needs recovery.
    _storage_call(image.image.storage.delete, image.image.name)
    image.delete()
    _normalize(product, list(product.images.all()))

"""JWT staff-only product gallery writes."""

from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from apps.catalog.image_serializers import (
    ImageOperationErrorSerializer,
    ProductImagePatchSerializer,
    ProductImageUploadSerializer,
)
from apps.catalog.image_services import (
    delete_product_image,
    patch_product_image,
    upload_product_image,
)
from apps.catalog.manage_serializers import ManageProductImageSerializer


class ProductImageUploadView(generics.GenericAPIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser]
    serializer_class = ProductImageUploadSerializer

    @extend_schema(
        tags=["Manage catalog"],
        request={"multipart/form-data": ProductImageUploadSerializer},
        responses={
            201: ManageProductImageSerializer,
            **{
                code: ImageOperationErrorSerializer
                for code in (400, 401, 403, 404, 415, 503)
            },
        },
        description="Append one verified JPEG/PNG/WebP image, at most 4 MiB.",
    )
    def post(self, request, id):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = upload_product_image(
            product_id=id, uploaded_file=serializer.validated_data["image"]
        )
        return Response(
            ManageProductImageSerializer(image, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ProductImageDetailView(generics.GenericAPIView):
    permission_classes = [IsAdminUser]
    parser_classes = [JSONParser]
    serializer_class = ProductImagePatchSerializer

    @extend_schema(
        tags=["Manage catalog"],
        responses={
            200: ManageProductImageSerializer,
            **{
                code: ImageOperationErrorSerializer
                for code in (400, 401, 403, 404, 415)
            },
        },
        description="Move to a zero-based position or select the main image.",
    )
    def patch(self, request, id, image_id):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = patch_product_image(
            product_id=id, image_id=image_id, data=serializer.validated_data
        )
        return Response(
            ManageProductImageSerializer(image, context={"request": request}).data
        )

    @extend_schema(
        tags=["Manage catalog"],
        request=None,
        responses={
            204: None,
            **{
                code: ImageOperationErrorSerializer
                for code in (400, 401, 403, 404, 503)
            },
        },
    )
    def delete(self, request, id, image_id):
        delete_product_image(product_id=id, image_id=image_id)
        return Response(status=status.HTTP_204_NO_CONTENT)

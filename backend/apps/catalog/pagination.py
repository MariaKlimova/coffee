"""Pagination matching OpenAPI page / page_size convention."""

from rest_framework.pagination import PageNumberPagination


class CatalogPagination(PageNumberPagination):
    """Paginate catalog lists with page and page_size query params."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

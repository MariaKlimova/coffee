/**
 * Category slug used by the catalog API and storefront routes.
 */
export type ProductCategorySlug = 'coffee' | 'machines'

/**
 * Human-readable labels for category slugs (UI overlines and page titles).
 */
export const CATEGORY_LABELS: Record<ProductCategorySlug, string> = {
  coffee: 'Кофе',
  machines: 'Кофемашины',
}

/**
 * Default page size — matches backend CatalogPagination.page_size.
 */
export const CATALOG_PAGE_SIZE = 20

/**
 * Placeholder shown when an optional product attribute is missing.
 */
export const MISSING_ATTRIBUTE = '—'

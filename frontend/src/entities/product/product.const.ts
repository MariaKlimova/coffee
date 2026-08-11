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
 * Storefront route that lists products of a category.
 */
export const CATEGORY_ROUTES: Record<ProductCategorySlug, '/coffee' | '/machines'> = {
  coffee: '/coffee',
  machines: '/machines',
}

/**
 * Default page size — matches backend CatalogPagination.page_size.
 */
export const CATALOG_PAGE_SIZE = 20

/**
 * Safety limit for the deep-link page scan — guards against an endless
 * `next` chain if the backend ever paginates unexpectedly.
 */
export const MAX_SCANNED_PAGES = 50

/**
 * Placeholder shown when an optional product attribute is missing.
 */
export const MISSING_ATTRIBUTE = '—'

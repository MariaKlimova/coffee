import type { ProductOrdering } from '@entities/product'

/**
 * Catalog UI state mirrored in the URL query string.
 */
export interface CatalogParams {
  /** Minimum price filter as a decimal string, or undefined when unset. */
  priceMin?: string
  /** Maximum price filter as a decimal string, or undefined when unset. */
  priceMax?: string
  /** When true, only in-stock products are requested. */
  inStockOnly: boolean
  /** Current sort order. */
  ordering: ProductOrdering
  /** 1-based page number. */
  page: number
  /** Expanded product slug (`?product=`), or null when none. */
  product: string | null
}

/**
 * Filter fields that can be updated without touching expand state directly.
 */
export interface CatalogFilterPatch {
  /** Minimum price filter as a decimal string, or undefined to clear. */
  priceMin?: string
  /** Maximum price filter as a decimal string, or undefined to clear. */
  priceMax?: string
  /** Availability filter. */
  inStockOnly?: boolean
  /** Sort order. */
  ordering?: ProductOrdering
}

import type { ProductOrdering } from '@entities/product'

/**
 * Catalog UI state mirrored in the URL query string.
 */
export interface CatalogParams {
  /** Поисковый запрос без крайних пробелов; undefined, если поиск не задан. */
  search?: string
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
}

/**
 * Фильтры каталога, обновляемые независимо от страницы.
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

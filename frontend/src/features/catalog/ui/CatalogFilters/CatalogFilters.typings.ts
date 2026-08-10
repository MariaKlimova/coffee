import type { ProductOrdering } from '@entities/product'

import type { CatalogFilterPatch } from '../../lib/catalogSearchParams.typings'

/**
 * Props for the catalog filter sidebar.
 */
export interface CatalogFiltersProps {
  /** Current minimum price as typed in the URL, or undefined. */
  priceMin?: string
  /** Current maximum price as typed in the URL, or undefined. */
  priceMax?: string
  /** Whether the in-stock-only checkbox is checked. */
  inStockOnly: boolean
  /** Current sort order. */
  ordering: ProductOrdering
  /** Applies a filter patch (resets page/expand upstream). */
  onChange: (patch: CatalogFilterPatch) => void
  /** Optional extra class name. */
  className?: string
}

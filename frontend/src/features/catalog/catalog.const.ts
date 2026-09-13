import type { ProductOrdering } from '@entities/product'
import { CATALOG_COPY } from '@shared/lib/copy'

export { CATALOG_COPY }

/**
 * Sort options shown in the catalog Select.
 */
export const SORT_OPTIONS: Array<{
  /** Ordering value sent to the API. */
  value: ProductOrdering
  /** Visible label. */
  label: string
}> = [
  { value: '-created_at', label: CATALOG_COPY.sortNewest },
  { value: 'price', label: CATALOG_COPY.sortCheapest },
  { value: '-price', label: CATALOG_COPY.sortPriceDesc },
]

/**
 * Default ordering when the URL has no `ordering` param.
 */
export const DEFAULT_ORDERING: ProductOrdering = '-created_at'

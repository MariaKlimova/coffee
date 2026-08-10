import type { ProductListItem } from '@entities/product'

/**
 * Props for a single catalog grid cell (card or expanded pane).
 */
export interface CatalogPageItemProps {
  /** Lightweight list row for the collapsed card. */
  product: ProductListItem
  /** Whether this product is currently expanded via `?product=`. */
  isExpanded: boolean
  /** Opens or toggles the expanded card for this product. */
  onExpand: (slug: string) => void
  /** Collapses the expanded card. */
  onCollapse: () => void
}

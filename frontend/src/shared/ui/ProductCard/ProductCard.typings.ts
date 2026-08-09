import type { HTMLAttributes } from 'react'

export interface ProductCardProps extends Omit<HTMLAttributes<HTMLElement>, 'id'> {
  /** Product identifier passed to expand / cart callbacks. */
  id: string
  /** Uppercase category label above the title. */
  categoryLabel: string
  /** Product title. */
  title: string
  /** Short description (clamped to 2 lines). */
  description?: string
  /** Image URLs for the carousel. */
  images: string[]
  /** Current price label (already formatted). */
  price: string
  /** Optional previous price (strikethrough). */
  oldPrice?: string
  /** Whether the product can be added to cart. */
  inStock?: boolean
  /** Favorite toggle visual state. */
  isFavorite?: boolean
  /** Favorite button handler. */
  onToggleFavorite?: (id: string) => void
  /** Add-to-cart handler. */
  onAddToCart?: (id: string) => void
  /** Expand handler for the card surface. */
  onExpand?: (id: string) => void
}

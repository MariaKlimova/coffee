/**
 * Props for the similar-products strip inside an expanded card.
 */
export interface SimilarProductsProps {
  /** Slug of the currently expanded product. */
  slug: string
  /** Opens another product from the strip. */
  onSelect: (slug: string) => void
  /** When true, clicks on cards are ignored (resolve in flight). */
  disabled?: boolean
  /** Favorite toggle for cards in the strip (product UUID + current flag). */
  onToggleFavorite?: (productId: string, isFavorite: boolean) => void
}

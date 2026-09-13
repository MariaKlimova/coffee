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
  /** Current cart quantity for a product UUID (0 / undefined = not in cart). */
  getCartQuantity?: (productId: string) => number
  /** Add-to-cart handler for cards in the strip (product UUID). */
  onAddToCart?: (productId: string) => void
  /** Quantity change from the card stepper (`0` removes the line). */
  onCartQuantityChange?: (productId: string, quantity: number) => void
}

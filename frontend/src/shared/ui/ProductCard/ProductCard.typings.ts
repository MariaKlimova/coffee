import type { HTMLAttributes } from 'react'

export interface ProductCardProps extends Omit<HTMLAttributes<HTMLElement>, 'id'> {
  /** Показывать действия покупки и избранного; выключено при просмотре владельцем. */
  shoppingEnabled?: boolean
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
  /** Add-to-cart handler (shown when the product is not in the cart yet). */
  onAddToCart?: (id: string) => void
  /**
   * Current quantity in the cart. When greater than 0, the card shows −/+ instead of «В корзину».
   */
  cartQuantity?: number
  /**
   * Quantity change from the card stepper. Pass `0` to remove the line from the cart.
   */
  onCartQuantityChange?: (id: string, quantity: number) => void
  /** Ссылка на страницу товара; без неё остаётся кнопка UI Kit. */
  href?: string
  /** Состояние React Router для возврата к исходному списку. */
  linkState?: unknown
  /** Действие перед открытием товара. */
  onExpand?: (id: string) => void
}

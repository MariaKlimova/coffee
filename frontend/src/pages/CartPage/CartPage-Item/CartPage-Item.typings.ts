import type { CartItem } from '@entities/cart'

/**
 * Props строки позиции на странице корзины.
 */
export interface CartPageItemProps {
  /** Позиция корзины из API. */
  item: CartItem
  /** Изменение количества (≥ 1). */
  onQuantityChange: (itemId: string, quantity: number) => void
  /** Удаление позиции. */
  onRemove: (itemId: string) => void
}

import type { CartItem } from '@entities/cart'

/**
 * Пропсы строки сводки заказа на чекауте.
 */
export interface CheckoutPageLineProps {
  /** Позиция корзины. */
  item: CartItem
}

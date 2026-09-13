import type { CartItem } from '@entities/cart'

/**
 * Пропсы боковой сводки заказа.
 */
export interface CheckoutPageSummaryProps {
  /** Позиции текущей корзины. */
  items: CartItem[]
  /** Итого только по позициям в наличии. */
  total: string
}

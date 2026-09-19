import type { OrderItem } from '@entities/order'

/**
 * Пропсы строки позиции на деталке заказа.
 */
export interface OrderDetailPageLineProps {
  /** Позиция со снимком цены. */
  item: OrderItem
}

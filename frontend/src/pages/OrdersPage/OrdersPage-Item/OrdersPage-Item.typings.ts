import type { OrderListItem } from '@entities/order'

/**
 * Пропсы строки списка заказов.
 */
export interface OrdersPageItemProps {
  /** Заказ из списка. */
  order: OrderListItem
}

import { queryOptions } from '@tanstack/react-query'

import { getOrder, listOrders } from '../api/orderApi'
import type { OrderListParams } from '../api/orderApi.typings'

export const orderKeys = {
  all: ['orders'] as const,
  /** Префикс всех пагинированных списков заказов. */
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (params: OrderListParams) => [...orderKeys.lists(), params] as const,
  detail: (orderId: string) => [...orderKeys.all, 'detail', orderId] as const,
}

/**
 * Пагинированный список заказов текущего пользователя.
 */
export function orderListQueryOptions(params: OrderListParams = {}) {
  return queryOptions({
    queryKey: orderKeys.list(params),
    queryFn: () => listOrders(params),
  })
}

/**
 * Детали заказа по UUID — для страницы результата оплаты и поллинга статуса.
 */
export function orderDetailQueryOptions(orderId: string) {
  return queryOptions({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => getOrder(orderId),
  })
}

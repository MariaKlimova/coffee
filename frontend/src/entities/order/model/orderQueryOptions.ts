import { queryOptions } from '@tanstack/react-query'

import { getOrder } from '../api/orderApi'

export const orderKeys = {
  all: ['orders'] as const,
  detail: (orderId: string) => [...orderKeys.all, 'detail', orderId] as const,
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

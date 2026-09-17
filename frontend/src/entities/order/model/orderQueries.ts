import { useQuery } from '@tanstack/react-query'

import { orderDetailQueryOptions } from './orderQueryOptions'

/**
 * Параметры `useOrder`: интервал поллинга и условие остановки.
 */
export interface UseOrderOptions {
  /**
   * Интервал refetch, пока заказ в `pending`.
   * `false` — без поллинга.
   */
  refetchIntervalMs?: number | false
  /**
   * Дополнительный стоп поллинга (таймаут на странице результата).
   * Если `true`, refetchInterval отключается.
   */
  stopPolling?: boolean
}

/**
 * Заказ по id. Опциональный поллинг, пока `status === 'pending'`.
 */
export function useOrder(orderId: string | null, options: UseOrderOptions = {}) {
  const { refetchIntervalMs = false, stopPolling = false } = options

  return useQuery({
    ...orderDetailQueryOptions(orderId ?? ''),
    enabled: Boolean(orderId),
    refetchInterval: (query) => {
      if (!orderId || stopPolling || refetchIntervalMs === false) {
        return false
      }
      const status = query.state.data?.status
      if (status && status !== 'pending') {
        return false
      }
      return refetchIntervalMs
    },
  })
}

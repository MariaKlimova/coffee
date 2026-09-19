import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useAuthStore } from '@entities/user'

import type { OrderListParams } from '../api/orderApi.typings'
import { orderDetailQueryOptions, orderListQueryOptions } from './orderQueryOptions'

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
 * Пагинированный список заказов авторизованного пользователя.
 * Для гостя запрос не уходит.
 */
export function useOrders(params: OrderListParams = {}) {
  const status = useAuthStore((state) => state.status)

  return useQuery({
    ...orderListQueryOptions(params),
    enabled: status === 'authenticated',
    placeholderData: keepPreviousData,
  })
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

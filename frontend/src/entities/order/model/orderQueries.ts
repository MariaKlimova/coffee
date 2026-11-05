import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CanceledError } from 'axios'

import { isSameCustomerSession, selectCanShop, useAuthStore } from '@entities/user'

import type { OrderListParams } from '../api/orderApi.typings'
import { orderDetailQueryOptions, orderListQueryOptions } from './orderQueryOptions'

/**
 * Параметры `useOrder`: интервал поллинга и условие остановки.
 */
export interface UseOrderOptions {
  /** Разрешение запроса после подготовки вызывающего сценария. */
  enabled?: boolean
  /** Непрозрачная область кэша; задаётся вызывающим слоем без токенов. */
  cacheScope?: string
  /** Срок хранения неиспользуемого результата в миллисекундах. */
  gcTime?: number
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
  const generation = useAuthStore((state) => state.sessionGeneration)
  const userId = useAuthStore((state) => state.user?.id)
  const canShop = useAuthStore(selectCanShop)
  const actor = useAuthStore.getState()
  const scope = `${generation}:${status}:${userId ?? 'guest'}`
  const assertActor = () => {
    if (
      !canShop ||
      status !== 'authenticated' ||
      !isSameCustomerSession(actor, useAuthStore.getState())
    )
      throw new CanceledError('Сессия заказов изменилась')
  }

  return useQuery({
    ...orderListQueryOptions(params, scope, assertActor),
    enabled: status === 'authenticated' && canShop,
    gcTime: 0,
    placeholderData: (previous, previousQuery) => {
      if (previousQuery?.queryKey.at(-1) === scope) return keepPreviousData(previous)
      return undefined
    },
  })
}

/**
 * Заказ по id. Опциональный поллинг, пока `status === 'pending'`.
 */
export function useOrder(orderId: string | null, options: UseOrderOptions = {}) {
  const status = useAuthStore((state) => state.status)
  const generation = useAuthStore((state) => state.sessionGeneration)
  const userId = useAuthStore((state) => state.user?.id)
  const canShop = useAuthStore(selectCanShop)
  const actor = useAuthStore.getState()
  const {
    refetchIntervalMs = false,
    stopPolling = false,
    enabled = true,
    cacheScope,
    gcTime,
  } = options
  const assertActor = () => {
    if (!canShop || !isSameCustomerSession(actor, useAuthStore.getState()))
      throw new CanceledError('Сессия заказа изменилась')
  }
  const detailOptions = orderDetailQueryOptions(
    orderId ?? '',
    `${generation}:${status}:${userId ?? 'guest'}:${cacheScope ?? ''}`,
    assertActor,
  )

  return useQuery({
    ...detailOptions,
    ...(gcTime === undefined ? {} : { gcTime }),
    enabled: enabled && canShop && Boolean(orderId),
    refetchInterval: (query) => {
      if (!enabled || !orderId || stopPolling || refetchIntervalMs === false) {
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

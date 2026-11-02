import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { cartKeys } from '@entities/cart'
import { useOrder, type Order, type OrderStatus } from '@entities/order'
import { useAuthStore } from '@entities/user'

import { clearPendingOrderId, resolveOrderIdFromReturn } from './pendingOrderId'
import { resolvePaymentRecoveryOrderId } from './paymentRecovery'
import { usePayOrder } from './usePayOrder'

/** Интервал поллинга статуса, пока заказ `pending`. */
export const ORDER_RESULT_POLL_INTERVAL_MS = 2_500

/** Максимальная длительность поллинга до «дольше обычного». */
export const ORDER_RESULT_POLL_TIMEOUT_MS = 30_000

/**
 * Состояние экрана результата оплаты для UI.
 */
export type OrderResultView =
  | 'missing'
  | 'loading'
  | 'error'
  | 'success'
  | 'pending'
  | 'delayed'
  | 'cancelled'
  | 'review'
  | 'recovery'

/**
 * Параметры хука результата оплаты.
 */
export interface UseOrderPaymentResultOptions {
  /** Редирект на `payment_url` (подменяется в тестах). */
  redirectToPayment?: (paymentUrl: string) => void
}

function isPaidLikeStatus(status: OrderStatus): boolean {
  return (
    status === 'paid' ||
    status === 'processing' ||
    status === 'shipped' ||
    status === 'delivered'
  )
}

function resolveView(
  orderId: string | null,
  order: Order | undefined,
  isError: boolean,
  pollTimedOut: boolean,
  needsPaymentRecovery: boolean,
): OrderResultView {
  if (!orderId) {
    return 'missing'
  }
  if (isError) {
    return 'error'
  }
  if (!order) {
    return 'loading'
  }
  if (isPaidLikeStatus(order.status)) {
    return 'success'
  }
  if (order.status === 'cancelled') {
    return 'cancelled'
  }
  if (order.status === 'payment_review') {
    return 'review'
  }
  if (order.status === 'pending') {
    if (needsPaymentRecovery) {
      return 'recovery'
    }
    if (pollTimedOut) {
      return 'delayed'
    }
    return 'pending'
  }
  return 'pending'
}

/**
 * Резолв order_id, поллинг статуса, инвалидация корзины и retry оплаты.
 */
export function useOrderPaymentResult({
  redirectToPayment,
}: UseOrderPaymentResultOptions = {}) {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  /** Стабильный id: не сбрасываем UI после clearPendingOrderId при успехе. */
  const [orderId] = useState(() => resolveOrderIdFromReturn(searchParams))
  const [needsPaymentRecovery] = useState(() =>
    Boolean(resolvePaymentRecoveryOrderId(searchParams)),
  )

  const authStatus = useAuthStore((state) => state.status)
  const userId = useAuthStore((state) => state.user?.id ?? null)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const accessToken = useAuthStore((state) => state.accessToken)
  // Решение о сессии принадлежит feature, entity заказа получает только допуск
  // и непрозрачный ключ. JWT не попадают в queryKey и не сохраняются в кэше.
  const session = useMemo(
    () => ({ authStatus, userId, refreshToken, cacheScope: crypto.randomUUID() }),
    [authStatus, userId, refreshToken],
  )
  const authReady =
    authStatus === 'guest' ||
    (authStatus === 'authenticated' && Boolean(userId && accessToken))
  const [timedOutScope, setTimedOutScope] = useState<string | null>(null)
  const pollTimedOut = timedOutScope === session.cacheScope
  const cartInvalidatedScopeRef = useRef<string | null>(null)
  const {
    payOrder,
    isPaying: isRetrying,
    error: retryError,
  } = usePayOrder({ redirectToPayment })

  useEffect(() => {
    if (!orderId || !authReady) {
      return
    }
    const timer = window.setTimeout(() => {
      setTimedOutScope(session.cacheScope)
    }, ORDER_RESULT_POLL_TIMEOUT_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [orderId, authReady, session.cacheScope])

  const orderQuery = useOrder(orderId, {
    enabled: authReady,
    cacheScope: session.cacheScope,
    gcTime: 0,
    refetchIntervalMs: ORDER_RESULT_POLL_INTERVAL_MS,
    stopPolling: pollTimedOut,
  })

  useEffect(() => {
    if (!authReady || !orderQuery.isSuccess || !orderQuery.data) {
      return
    }
    if (cartInvalidatedScopeRef.current !== session.cacheScope) {
      cartInvalidatedScopeRef.current = session.cacheScope
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    }
    if (
      isPaidLikeStatus(orderQuery.data.status) ||
      orderQuery.data.status === 'payment_review' ||
      orderQuery.data.status === 'cancelled'
    ) {
      clearPendingOrderId()
    }
  }, [
    authReady,
    session.cacheScope,
    orderQuery.isSuccess,
    orderQuery.data,
    queryClient,
  ])

  const order = authReady ? orderQuery.data : undefined
  const view =
    orderId && !authReady
      ? 'loading'
      : resolveView(
          orderId,
          order,
          orderQuery.isError,
          pollTimedOut,
          needsPaymentRecovery,
        )

  async function retryPayment(): Promise<void> {
    if (!authReady || !orderId || order?.status !== 'pending') {
      return
    }
    await payOrder(orderId)
  }

  return {
    orderId,
    order,
    view,
    isRetrying,
    retryError,
    retryPayment,
    refetchOrder: () => {
      if (!authReady) return
      void orderQuery.refetch()
    },
  }
}

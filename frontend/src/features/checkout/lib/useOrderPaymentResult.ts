import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { cartKeys } from '@entities/cart'
import { useOrder, type Order, type OrderStatus } from '@entities/order'

import { clearPendingOrderId, resolveOrderIdFromReturn } from './pendingOrderId'
import { usePayOrder } from './usePayOrder'

/** Интервал поллинга статуса, пока заказ `pending`. */
export const ORDER_RESULT_POLL_INTERVAL_MS = 2_500

/** Максимальная длительность поллинга до «дольше обычного». */
export const ORDER_RESULT_POLL_TIMEOUT_MS = 30_000

/**
 * Состояние экрана результата оплаты для UI.
 */
export type OrderResultView =
  'missing' | 'loading' | 'error' | 'success' | 'pending' | 'delayed' | 'failed'

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
    return 'failed'
  }
  if (order.status === 'pending') {
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

  const [pollTimedOut, setPollTimedOut] = useState(false)
  const cartInvalidatedRef = useRef(false)
  const {
    payOrder,
    isPaying: isRetrying,
    error: retryError,
  } = usePayOrder({ redirectToPayment })

  useEffect(() => {
    if (!orderId) {
      return
    }
    const timer = window.setTimeout(() => {
      setPollTimedOut(true)
    }, ORDER_RESULT_POLL_TIMEOUT_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [orderId])

  const orderQuery = useOrder(orderId, {
    refetchIntervalMs: ORDER_RESULT_POLL_INTERVAL_MS,
    stopPolling: pollTimedOut,
  })

  useEffect(() => {
    if (!orderQuery.isSuccess || !orderQuery.data) {
      return
    }
    if (cartInvalidatedRef.current) {
      return
    }
    cartInvalidatedRef.current = true
    void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    if (isPaidLikeStatus(orderQuery.data.status)) {
      clearPendingOrderId()
    }
  }, [orderQuery.isSuccess, orderQuery.data, queryClient])

  const view = resolveView(orderId, orderQuery.data, orderQuery.isError, pollTimedOut)

  async function retryPayment(): Promise<void> {
    if (!orderId) {
      return
    }
    await payOrder(orderId)
  }

  return {
    orderId,
    order: orderQuery.data,
    view,
    isRetrying,
    retryError,
    retryPayment,
    refetchOrder: () => {
      void orderQuery.refetch()
    },
  }
}

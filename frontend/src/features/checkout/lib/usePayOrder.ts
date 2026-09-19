import { useState } from 'react'

import { createPayment } from '@entities/order'
import { CHECKOUT_COPY } from '@shared/lib/copy'

import { writePendingOrderId } from './pendingOrderId'

/**
 * Параметры хука оплаты существующего заказа.
 */
export interface UsePayOrderOptions {
  /** Редирект на `payment_url` (подменяется в тестах). */
  redirectToPayment?: (paymentUrl: string) => void
}

/**
 * Создаёт платёжную сессию и уводит на страницу провайдера.
 * Используется с деталки заказа и с экрана результата оплаты.
 */
export function usePayOrder({
  redirectToPayment = (paymentUrl) => {
    window.location.assign(paymentUrl)
  },
}: UsePayOrderOptions = {}) {
  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function payOrder(orderId: string): Promise<void> {
    if (!orderId || isPaying) {
      return
    }
    setError(undefined)
    setIsPaying(true)
    try {
      writePendingOrderId(orderId)
      const payment = await createPayment(orderId)
      redirectToPayment(payment.payment_url)
    } catch {
      setError(CHECKOUT_COPY.paymentError)
      setIsPaying(false)
    }
  }

  return {
    payOrder,
    isPaying,
    error,
  }
}

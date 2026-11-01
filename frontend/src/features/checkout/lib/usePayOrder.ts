import { useRef, useState } from 'react'

import { createPayment } from '@entities/order'
import { CHECKOUT_COPY } from '@shared/lib/copy'

import {
  clearPaymentRecoveryOrderId,
  writePaymentRecoveryOrderId,
} from './pendingOrderId'

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
  const payingRef = useRef(false)

  async function payOrder(orderId: string): Promise<void> {
    if (!orderId || payingRef.current) {
      return
    }
    setError(undefined)
    payingRef.current = true
    setIsPaying(true)
    try {
      writePaymentRecoveryOrderId(orderId)
      const payment = await createPayment(orderId)
      redirectToPayment(payment.payment_url)
      clearPaymentRecoveryOrderId()
    } catch {
      setError(CHECKOUT_COPY.paymentError)
      setIsPaying(false)
      payingRef.current = false
    }
  }

  return {
    payOrder,
    isPaying,
    error,
  }
}

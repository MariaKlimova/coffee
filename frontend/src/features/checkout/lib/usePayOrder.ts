import { useEffect, useRef, useState } from 'react'
import { CanceledError, isCancel } from 'axios'

import { isSameCustomerSession, selectCanShop, useAuthStore } from '@entities/user'
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
  const renderedActor = useAuthStore.getState()
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])

  async function payOrder(orderId: string): Promise<void> {
    if (
      !active.current ||
      !selectCanShop(useAuthStore.getState()) ||
      !isSameCustomerSession(renderedActor, useAuthStore.getState()) ||
      !orderId ||
      payingRef.current
    ) {
      return
    }
    setError(undefined)
    payingRef.current = true
    setIsPaying(true)
    try {
      writePaymentRecoveryOrderId(orderId)
      const session = renderedActor
      const assertActor = () => {
        if (!active.current || !isSameCustomerSession(session, useAuthStore.getState()))
          throw new CanceledError('Сессия оплаты изменилась')
      }
      const payment = await createPayment(orderId, assertActor)
      if (!isSameCustomerSession(session, useAuthStore.getState())) return
      redirectToPayment(payment.payment_url)
      clearPaymentRecoveryOrderId()
    } catch (failure) {
      if (
        isCancel(failure) ||
        !active.current ||
        !isSameCustomerSession(renderedActor, useAuthStore.getState())
      )
        return
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

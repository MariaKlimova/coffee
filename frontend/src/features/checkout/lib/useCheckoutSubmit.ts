import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'

import { cartKeys } from '@entities/cart'
import { createOrder, createPayment } from '@entities/order'

import { mapCheckoutApiError } from './mapCheckoutApiError'
import {
  clearPaymentRecoveryOrderId,
  writePaymentRecoveryOrderId,
} from './pendingOrderId'
import {
  hasCheckoutFieldErrors,
  validateCheckoutForm,
  type CheckoutFieldErrors,
  type CheckoutFormValues,
} from './validateCheckoutForm'

/**
 * Параметры submit-хука чекаута.
 */
export interface UseCheckoutSubmitOptions {
  /** Гость без JWT — нужны email и телефон. */
  isGuest: boolean
  /** Сохраняет id в адресе страницы до обращения к провайдеру. */
  onOrderCreated?: (orderId: string) => void
  /** Редирект на `payment_url` провайдера (подменяется в тестах). */
  redirectToPayment?: (paymentUrl: string) => void
}

/**
 * Состояние и обработчик «Оплатить»: order → payment → redirect.
 */
export function useCheckoutSubmit({
  isGuest,
  onOrderCreated,
  redirectToPayment = (paymentUrl) => {
    window.location.assign(paymentUrl)
  },
}: UseCheckoutSubmitOptions) {
  const queryClient = useQueryClient()
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({})
  const [formError, setFormError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const submittingRef = useRef(false)

  function clearFieldError(field: keyof CheckoutFieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev
      }
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    values: CheckoutFormValues,
  ): Promise<void> {
    event.preventDefault()
    if (submittingRef.current || createdOrderId) {
      return
    }

    setFormError(undefined)
    const errors = validateCheckoutForm(values, { isGuest })
    if (hasCheckoutFieldErrors(errors)) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    submittingRef.current = true
    setIsSubmitting(true)

    try {
      const payload = {
        delivery_address: values.deliveryAddress.trim(),
        ...(isGuest
          ? {
              guest_email: values.email.trim(),
              guest_phone: values.phone.trim(),
            }
          : {}),
      }

      const order = await createOrder(payload)
      writePaymentRecoveryOrderId(order.id)
      setCreatedOrderId(order.id)
      onOrderCreated?.(order.id)
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
      const payment = await createPayment(order.id)
      redirectToPayment(payment.payment_url)
      clearPaymentRecoveryOrderId()
    } catch (error) {
      const view = mapCheckoutApiError(error)
      setFormError(view.formError)
      setFieldErrors(view.fieldErrors)
      setIsSubmitting(false)
      submittingRef.current = false
    }
  }

  return {
    fieldErrors,
    formError,
    isSubmitting,
    createdOrderId,
    clearFieldError,
    handleSubmit,
  }
}

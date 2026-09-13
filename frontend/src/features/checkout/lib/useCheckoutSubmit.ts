import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { cartKeys } from '@entities/cart'
import { createOrder, createPayment } from '@entities/order'

import { mapCheckoutApiError } from './mapCheckoutApiError'
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
  /** Редирект на `payment_url` провайдера (подменяется в тестах). */
  redirectToPayment?: (paymentUrl: string) => void
}

/**
 * Состояние и обработчик «Оплатить»: order → payment → redirect.
 */
export function useCheckoutSubmit({
  isGuest,
  redirectToPayment = (paymentUrl) => {
    window.location.assign(paymentUrl)
  },
}: UseCheckoutSubmitOptions) {
  const queryClient = useQueryClient()
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({})
  const [formError, setFormError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    if (isSubmitting) {
      return
    }

    setFormError(undefined)
    const errors = validateCheckoutForm(values, { isGuest })
    if (hasCheckoutFieldErrors(errors)) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
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
      await queryClient.invalidateQueries({ queryKey: cartKeys.all })
      const payment = await createPayment(order.id)
      redirectToPayment(payment.payment_url)
    } catch (error) {
      const view = mapCheckoutApiError(error)
      setFormError(view.formError)
      setFieldErrors(view.fieldErrors)
      setIsSubmitting(false)
    }
  }

  return {
    fieldErrors,
    formError,
    isSubmitting,
    clearFieldError,
    handleSubmit,
  }
}

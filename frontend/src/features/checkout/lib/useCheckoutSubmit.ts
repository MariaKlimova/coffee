import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { CanceledError, isAxiosError, isCancel } from 'axios'

import { isSameCustomerSession, selectCanShop, useAuthStore } from '@entities/user'
import { cartKeys, useCartStore } from '@entities/cart'
import {
  clearGuestCheckoutIntent,
  createOrder,
  createPayment,
  readGuestCheckoutIntent,
  recoverGuestCheckout,
  writeGuestCheckoutIntent,
  writeGuestOrderProof,
  type GuestCheckoutIntent,
} from '@entities/order'
import { CANCELLATION_COPY } from '@shared/lib/copy'

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
  const [isRecovering, setIsRecovering] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [unresolvedGuestCheckout, setUnresolvedGuestCheckout] = useState(
    readGuestCheckoutIntent,
  )
  const submittingRef = useRef(false)
  const renderedActor = useAuthStore.getState()

  function bindCustomer() {
    const session = renderedActor
    return () => {
      if (!isSameCustomerSession(session, useAuthStore.getState()))
        throw new CanceledError('Сессия оформления изменилась')
    }
  }

  async function recoverCheckout(): Promise<void> {
    const intent = readGuestCheckoutIntent()
    if (!intent || useAuthStore.getState().status !== 'guest' || submittingRef.current)
      return
    const assertActor = bindCustomer()
    try {
      assertActor()
    } catch {
      return
    }
    submittingRef.current = true
    setIsSubmitting(true)
    setIsRecovering(true)
    setFormError(undefined)
    try {
      const result = await recoverGuestCheckout(
        intent.checkoutRequestId,
        intent.originalCartToken,
        assertActor,
      )
      assertActor()
      writeGuestOrderProof({
        ...intent,
        orderId: result.order.id,
        token: result.guest_action_token,
        version: result.guest_action_version,
      })
      clearGuestCheckoutIntent(intent.checkoutRequestId)
      setUnresolvedGuestCheckout(null)
      writePaymentRecoveryOrderId(result.order.id)
      setCreatedOrderId(result.order.id)
      onOrderCreated?.(result.order.id)
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    } catch (error) {
      try {
        assertActor()
      } catch {
        return
      }
      if (!isCancel(error)) setFormError(CANCELLATION_COPY.recoveryError)
    } finally {
      try {
        assertActor()
        submittingRef.current = false
        setIsSubmitting(false)
        setIsRecovering(false)
      } catch {
        /* Поздний результат не меняет новую сессию. */
      }
    }
  }

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
    const assertActor = bindCustomer()
    try {
      assertActor()
    } catch {
      return
    }
    if (
      !selectCanShop(useAuthStore.getState()) ||
      submittingRef.current ||
      createdOrderId
    ) {
      return
    }
    if (isGuest && readGuestCheckoutIntent()) {
      setUnresolvedGuestCheckout(readGuestCheckoutIntent())
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

    let guestIntent: GuestCheckoutIntent | null = null
    try {
      if (isGuest) {
        const originalCartToken = useCartStore.getState().cartToken
        if (!originalCartToken) throw new Error(CANCELLATION_COPY.storageError)
        guestIntent = { checkoutRequestId: crypto.randomUUID(), originalCartToken }
        try {
          writeGuestCheckoutIntent(guestIntent)
        } catch {
          throw new Error(CANCELLATION_COPY.storageError)
        }
        setUnresolvedGuestCheckout(guestIntent)
      }
      const payload = {
        ...(guestIntent ? { checkout_request_id: guestIntent.checkoutRequestId } : {}),
        delivery_address: values.deliveryAddress.trim(),
        ...(isGuest
          ? {
              guest_email: values.email.trim(),
              guest_phone: values.phone.trim(),
            }
          : {}),
      }

      const order = await createOrder(
        payload,
        assertActor,
        guestIntent?.originalCartToken,
      )
      assertActor()
      if (guestIntent) {
        if (!order.guest_action_token || !order.guest_action_version)
          throw new Error(CANCELLATION_COPY.storageError)
        try {
          writeGuestOrderProof({
            ...guestIntent,
            orderId: order.id,
            token: order.guest_action_token,
            version: order.guest_action_version,
          })
          clearGuestCheckoutIntent(guestIntent.checkoutRequestId)
        } catch {
          throw new Error(CANCELLATION_COPY.storageError)
        }
        setUnresolvedGuestCheckout(null)
      }
      writePaymentRecoveryOrderId(order.id)
      setCreatedOrderId(order.id)
      onOrderCreated?.(order.id)
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
      const payment = await createPayment(order.id, assertActor)
      assertActor()
      redirectToPayment(payment.payment_url)
      clearPaymentRecoveryOrderId()
    } catch (error) {
      if (isCancel(error)) return
      try {
        assertActor()
      } catch {
        return
      }
      if (guestIntent && isAxiosError(error) && error.response?.status === 400) {
        clearGuestCheckoutIntent(guestIntent.checkoutRequestId)
        setUnresolvedGuestCheckout(null)
      }
      const view = mapCheckoutApiError(error)
      setFormError(
        error instanceof Error && error.message === CANCELLATION_COPY.storageError
          ? error.message
          : view.formError,
      )
      setFieldErrors(view.fieldErrors)
      setIsSubmitting(false)
      submittingRef.current = false
    }
  }

  return {
    fieldErrors,
    formError,
    isSubmitting,
    isRecovering,
    createdOrderId,
    unresolvedGuestCheckout: isGuest ? unresolvedGuestCheckout : null,
    recoverCheckout,
    clearFieldError,
    handleSubmit,
  }
}

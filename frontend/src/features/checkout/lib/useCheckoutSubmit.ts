import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
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
  const currentCartToken = useCartStore((state) => state.cartToken)
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({})
  const [formError, setFormError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)
  const [missingCheckoutId, setMissingCheckoutId] = useState<string | null>(null)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [unresolvedGuestCheckout, setUnresolvedGuestCheckout] = useState(
    readGuestCheckoutIntent,
  )
  const submittingRef = useRef(false)
  const renderedActor = useAuthStore.getState()
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])

  function bindCustomer() {
    const session = renderedActor
    return () => {
      if (!active.current || !isSameCustomerSession(session, useAuthStore.getState()))
        throw new CanceledError('Сессия оформления изменилась')
    }
  }

  function rememberGuestOrder(
    intent: GuestCheckoutIntent,
    orderId: string,
    token: string,
    version: number,
  ) {
    writeGuestOrderProof({ ...intent, orderId, token, version })
    clearGuestCheckoutIntent(intent.checkoutRequestId)
    setUnresolvedGuestCheckout(null)
    setMissingCheckoutId(null)
    writePaymentRecoveryOrderId(orderId)
    setCreatedOrderId(orderId)
    onOrderCreated?.(orderId)
    void queryClient.invalidateQueries({ queryKey: cartKeys.all })
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
      rememberGuestOrder(
        intent,
        result.order.id,
        result.guest_action_token,
        result.guest_action_version,
      )
    } catch (error) {
      try {
        assertActor()
      } catch {
        return
      }
      if (!isCancel(error)) {
        const missing = isAxiosError(error) && error.response?.status === 404
        if (missing) void queryClient.invalidateQueries({ queryKey: cartKeys.all })
        setMissingCheckoutId(missing ? intent.checkoutRequestId : null)
        setFormError(
          missing && intent.createBody
            ? CANCELLATION_COPY.checkoutNotFound
            : CANCELLATION_COPY.recoveryError,
        )
      }
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

  /** Явный повтор использует только сохранённые UUID, доказательство и тело исходного оформления. */
  async function retryGuestCheckout(): Promise<void> {
    const intent = readGuestCheckoutIntent()
    if (
      !intent?.createBody ||
      intent.checkoutRequestId !== missingCheckoutId ||
      useAuthStore.getState().status !== 'guest' ||
      submittingRef.current ||
      useCartStore.getState().cartToken !== intent.originalCartToken
    )
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
      try {
        const order = await createOrder(
          { checkout_request_id: intent.checkoutRequestId, ...intent.createBody },
          assertActor,
          intent.originalCartToken,
        )
        assertActor()
        if (!order.guest_action_token || !order.guest_action_version)
          throw new Error(CANCELLATION_COPY.storageError)
        rememberGuestOrder(
          intent,
          order.id,
          order.guest_action_token,
          order.guest_action_version,
        )
      } catch (error) {
        assertActor()
        if (
          !isAxiosError(error) ||
          error.response?.status !== 409 ||
          error.response.data?.code !== 'checkout_recovery_required'
        )
          throw error
        const recovered = await recoverGuestCheckout(
          intent.checkoutRequestId,
          intent.originalCartToken,
          assertActor,
        )
        assertActor()
        rememberGuestOrder(
          intent,
          recovered.order.id,
          recovered.guest_action_token,
          recovered.guest_action_version,
        )
      }
    } catch (error) {
      try {
        assertActor()
      } catch {
        return
      }
      if (!isCancel(error)) {
        const view = mapCheckoutApiError(error)
        setFormError(
          isAxiosError(error) && error.response?.status === 400
            ? view.formError
            : CANCELLATION_COPY.checkoutRetryError,
        )
      }
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
        guestIntent = {
          checkoutRequestId: crypto.randomUUID(),
          originalCartToken,
          createBody: {
            delivery_address: values.deliveryAddress.trim(),
            guest_email: values.email.trim(),
            guest_phone: values.phone.trim(),
          },
        }
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
          rememberGuestOrder(
            guestIntent,
            order.id,
            order.guest_action_token,
            order.guest_action_version,
          )
        } catch {
          throw new Error(CANCELLATION_COPY.storageError)
        }
      } else {
        writePaymentRecoveryOrderId(order.id)
        setCreatedOrderId(order.id)
        onOrderCreated?.(order.id)
        void queryClient.invalidateQueries({ queryKey: cartKeys.all })
      }
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
    canRetryGuestCheckout:
      isGuest &&
      Boolean(
        unresolvedGuestCheckout?.createBody &&
        unresolvedGuestCheckout.checkoutRequestId === missingCheckoutId &&
        currentCartToken === unresolvedGuestCheckout.originalCartToken,
      ),
    retryCartChanged:
      isGuest &&
      Boolean(
        unresolvedGuestCheckout?.createBody &&
        unresolvedGuestCheckout.checkoutRequestId === missingCheckoutId &&
        currentCartToken !== unresolvedGuestCheckout.originalCartToken,
      ),
    createdOrderId,
    unresolvedGuestCheckout: isGuest ? unresolvedGuestCheckout : null,
    recoverCheckout,
    retryGuestCheckout,
    clearFieldError,
    handleSubmit,
  }
}

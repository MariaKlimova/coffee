import axios from 'axios'

import { CHECKOUT_COPY } from '@shared/lib/copy'

import type { CheckoutFieldErrors, CheckoutFieldName } from './validateCheckoutForm'

/**
 * Тело ошибки API `{ detail, code[, errors] }`.
 */
interface ApiErrorBody {
  /** Краткое описание. */
  detail?: string
  /** Машинный код. */
  code?: string
  /** Ошибки по полям. */
  errors?: Partial<Record<string, string[]>>
}

/**
 * Представление ошибки для UI чекаута.
 */
export interface CheckoutErrorView {
  /** Общее сообщение над формой. */
  formError?: string
  /** Сообщения у полей. */
  fieldErrors: CheckoutFieldErrors
}

function firstMessage(
  errors: ApiErrorBody['errors'],
  field: string,
): string | undefined {
  const messages = errors?.[field]
  if (!messages || messages.length === 0) {
    return undefined
  }
  return messages[0]
}

function mapUnavailableProducts(errors: ApiErrorBody['errors']): string | undefined {
  const names = errors?.unavailable_products
  if (!names || names.length === 0) {
    return undefined
  }
  const list = names.join(', ')
  return `${CHECKOUT_COPY.unavailablePrefix}: ${list}. ${CHECKOUT_COPY.unavailableSuffix}`
}

const FIELD_MAP: Record<string, CheckoutFieldName> = {
  delivery_address: 'deliveryAddress',
  guest_email: 'email',
  guest_phone: 'phone',
}

/**
 * Переводит ошибку createOrder / createPayment в русские тексты UI.
 */
export function mapCheckoutApiError(error: unknown): CheckoutErrorView {
  if (!axios.isAxiosError(error)) {
    return { formError: CHECKOUT_COPY.formErrorGeneric, fieldErrors: {} }
  }

  const status = error.response?.status
  const data = (error.response?.data ?? {}) as ApiErrorBody
  const url = error.config?.url ?? ''

  if (status === 400 && data.errors) {
    const unavailable = mapUnavailableProducts(data.errors)
    if (unavailable) {
      return { formError: unavailable, fieldErrors: {} }
    }

    const fieldErrors: CheckoutFieldErrors = {}
    for (const [apiField, formField] of Object.entries(FIELD_MAP)) {
      const message = firstMessage(data.errors, apiField)
      if (!message) {
        continue
      }
      if (formField === 'deliveryAddress') {
        fieldErrors.deliveryAddress = CHECKOUT_COPY.addressRequired
      } else if (formField === 'email') {
        fieldErrors.email = CHECKOUT_COPY.emailInvalid
      } else {
        fieldErrors.phone = CHECKOUT_COPY.phoneRequired
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors }
    }

    const nonField = firstMessage(data.errors, 'non_field_errors')
    if (nonField) {
      return { formError: CHECKOUT_COPY.formErrorGeneric, fieldErrors: {} }
    }
  }

  if (url.includes('/api/payments/')) {
    return { formError: CHECKOUT_COPY.paymentError, fieldErrors: {} }
  }

  return { formError: CHECKOUT_COPY.formErrorGeneric, fieldErrors: {} }
}

import { CHECKOUT_COPY } from '@shared/lib/copy'

/**
 * Значения формы оформления заказа.
 */
export interface CheckoutFormValues {
  /** Адрес доставки. */
  deliveryAddress: string
  /** Почта (для гостя). */
  email: string
  /** Телефон (для гостя). */
  phone: string
}

/**
 * Имена полей формы чекаута.
 */
export type CheckoutFieldName = 'deliveryAddress' | 'email' | 'phone'

/**
 * Ошибки полей формы.
 */
export type CheckoutFieldErrors = Partial<Record<CheckoutFieldName, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalize(value: string): string {
  return value.trim()
}

/**
 * Клиентская валидация формы чекаута.
 * Для гостя обязательны почта и телефон.
 */
export function validateCheckoutForm(
  values: CheckoutFormValues,
  options: {
    /** Гость без JWT. */
    isGuest: boolean
  },
): CheckoutFieldErrors {
  const { isGuest } = options
  const errors: CheckoutFieldErrors = {}

  if (!normalize(values.deliveryAddress)) {
    errors.deliveryAddress = CHECKOUT_COPY.addressRequired
  }

  if (isGuest) {
    const email = normalize(values.email)
    if (!email) {
      errors.email = CHECKOUT_COPY.emailRequired
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = CHECKOUT_COPY.emailInvalid
    }

    if (!normalize(values.phone)) {
      errors.phone = CHECKOUT_COPY.phoneRequired
    }
  }

  return errors
}

/**
 * True, если в карте ошибок есть хотя бы одно сообщение.
 */
export function hasCheckoutFieldErrors(errors: CheckoutFieldErrors): boolean {
  return Object.keys(errors).length > 0
}

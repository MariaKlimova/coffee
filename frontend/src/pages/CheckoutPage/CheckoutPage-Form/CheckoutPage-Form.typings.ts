import type { FormEvent } from 'react'

/**
 * Пропсы формы оформления заказа.
 */
export interface CheckoutPageFormProps {
  /** Показывать поля почты и телефона. */
  isGuest: boolean
  /** Форма недоступна (идёт оплата или нет товаров в наличии). */
  disabled: boolean
  /** Идёт создание заказа и платежа. */
  isSubmitting: boolean
  /** Общая ошибка над формой. */
  formError?: string
  /** Ошибки полей. */
  fieldErrors: {
    /** Адрес. */
    deliveryAddress?: string
    /** Почта. */
    email?: string
    /** Телефон. */
    phone?: string
  }
  /** Текущие значения. */
  values: {
    /** Адрес доставки. */
    deliveryAddress: string
    /** Почта. */
    email: string
    /** Телефон. */
    phone: string
  }
  /** Можно ли нажимать «Оплатить». */
  canPay: boolean
  /** Смена поля. */
  onChange: (field: 'deliveryAddress' | 'email' | 'phone', value: string) => void
  /** Submit формы. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

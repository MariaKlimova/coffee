import { useEffect, useRef } from 'react'

import { CHECKOUT_COPY } from '@shared/lib/copy'
import { Button, Input } from '@shared/ui'

import type { CheckoutPageFormProps } from './CheckoutPage-Form.typings'
import styles from './CheckoutPage-Form.module.css'

/**
 * Форма доставки и контактов с кнопкой оплаты.
 */
export function CheckoutPageForm({
  isGuest,
  disabled,
  isSubmitting,
  formError,
  fieldErrors,
  values,
  canPay,
  onChange,
  onSubmit,
}: CheckoutPageFormProps) {
  const formErrorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (formError) {
      formErrorRef.current?.focus()
    }
  }, [formError])

  return (
    <form className={styles['CheckoutPage-Form']} onSubmit={onSubmit} noValidate>
      {formError ? (
        <p
          ref={formErrorRef}
          className={styles['CheckoutPage-Form-Error']}
          role="alert"
          tabIndex={-1}
        >
          {formError}
        </p>
      ) : null}

      <Input
        label={CHECKOUT_COPY.addressLabel}
        name="delivery_address"
        autoComplete="street-address"
        value={values.deliveryAddress}
        errorText={fieldErrors.deliveryAddress}
        disabled={disabled}
        onChange={(event) => {
          onChange('deliveryAddress', event.target.value)
        }}
      />

      {isGuest ? (
        <>
          <Input
            label={CHECKOUT_COPY.emailLabel}
            type="email"
            name="guest_email"
            autoComplete="email"
            value={values.email}
            errorText={fieldErrors.email}
            disabled={disabled}
            onChange={(event) => {
              onChange('email', event.target.value)
            }}
          />
          <Input
            label={CHECKOUT_COPY.phoneLabel}
            type="tel"
            name="guest_phone"
            autoComplete="tel"
            value={values.phone}
            errorText={fieldErrors.phone}
            disabled={disabled}
            onChange={(event) => {
              onChange('phone', event.target.value)
            }}
          />
        </>
      ) : null}

      <Button
        type="submit"
        loading={isSubmitting}
        disabled={!canPay || disabled}
        className={styles['CheckoutPage-Form-Submit']}
        aria-label={isSubmitting ? CHECKOUT_COPY.paying : CHECKOUT_COPY.pay}
      >
        {isSubmitting ? CHECKOUT_COPY.paying : CHECKOUT_COPY.pay}
      </Button>
    </form>
  )
}

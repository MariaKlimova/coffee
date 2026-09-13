import { describe, expect, it } from 'vitest'

import { CHECKOUT_COPY } from '@shared/lib/copy'

import { validateCheckoutForm } from './validateCheckoutForm'

describe('validateCheckoutForm', () => {
  it('requires address for everyone', () => {
    const errors = validateCheckoutForm(
      { deliveryAddress: '  ', email: '', phone: '' },
      { isGuest: false },
    )
    expect(errors.deliveryAddress).toBe(CHECKOUT_COPY.addressRequired)
    expect(errors.email).toBeUndefined()
  })

  it('requires guest email and phone', () => {
    const errors = validateCheckoutForm(
      { deliveryAddress: 'Москва', email: 'bad', phone: '' },
      { isGuest: true },
    )
    expect(errors.email).toBe(CHECKOUT_COPY.emailInvalid)
    expect(errors.phone).toBe(CHECKOUT_COPY.phoneRequired)
  })
})

import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'

import { CHECKOUT_COPY } from '@shared/lib/copy'

import { mapCheckoutApiError } from './mapCheckoutApiError'

function axiosError(status: number, data: unknown, url = '/api/orders/'): unknown {
  const config = { url } as InternalAxiosRequestConfig
  const response = {
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
  } as AxiosResponse
  return new AxiosError('error', AxiosError.ERR_BAD_REQUEST, config, null, response)
}

describe('mapCheckoutApiError', () => {
  it('maps unavailable products to a readable message', () => {
    const view = mapCheckoutApiError(
      axiosError(400, {
        detail: 'Invalid input',
        code: 'validation_error',
        errors: {
          unavailable_products: ['Эфиопия', 'Бразилия'],
        },
      }),
    )
    expect(view.formError).toContain('Эфиопия')
    expect(view.formError).toContain('Бразилия')
    expect(view.formError).toContain(CHECKOUT_COPY.unavailablePrefix)
  })

  it('uses payment copy for payment endpoint failures', () => {
    const view = mapCheckoutApiError(
      axiosError(502, { detail: 'down', code: 'error' }, '/api/payments/create/'),
    )
    expect(view.formError).toBe(CHECKOUT_COPY.paymentError)
  })
})

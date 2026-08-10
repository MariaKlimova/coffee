import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'

import { AUTH_COPY } from '../auth.const'
import { mapAuthApiError } from './mapAuthApiError'

function axiosError(status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, undefined, null, {
    data,
    status,
    statusText: String(status),
    headers: {},
    config: {} as never,
  })
}

describe('mapAuthApiError', () => {
  it('maps a duplicate email to the email field', () => {
    const view = mapAuthApiError(
      axiosError(400, {
        detail: 'Invalid input',
        code: 'validation_error',
        errors: { email: ['A user with this email already exists.'] },
      }),
      'register',
    )

    expect(view.formError).toBeUndefined()
    expect(view.fieldErrors.email).toBe(AUTH_COPY.emailTaken)
  })

  it('maps login 401 to a generic form error', () => {
    const view = mapAuthApiError(
      axiosError(401, {
        detail: 'No active account found with the given credentials.',
        code: 'authentication_failed',
      }),
      'login',
    )

    expect(view.formError).toBe(AUTH_COPY.loginFailed)
    expect(view.fieldErrors).toEqual({})
  })

  it('maps a network error to the generic message', () => {
    const view = mapAuthApiError(new Error('Network Error'), 'login')
    expect(view.formError).toBe(AUTH_COPY.genericError)
    expect(view.fieldErrors).toEqual({})
  })
})

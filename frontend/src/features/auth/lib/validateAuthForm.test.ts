import { describe, expect, it } from 'vitest'

import { AUTH_COPY } from '../auth.const'
import {
  hasAuthFieldErrors,
  validateLoginForm,
  validateRegisterForm,
} from './validateAuthForm'

describe('validateLoginForm', () => {
  it('rejects an invalid email', () => {
    expect(
      validateLoginForm({ email: 'not-an-email', password: 'password12' }),
    ).toEqual({ email: AUTH_COPY.emailInvalid })
  })

  it('allows a short password so the API can reject credentials', () => {
    expect(
      validateLoginForm({ email: 'masha@example.com', password: 'short' }),
    ).toEqual({})
  })

  it('rejects an empty password', () => {
    expect(validateLoginForm({ email: 'masha@example.com', password: '' })).toEqual({
      password: AUTH_COPY.passwordRequired,
    })
  })
})

describe('validateRegisterForm', () => {
  it('rejects a short password', () => {
    expect(
      validateRegisterForm({
        email: 'masha@example.com',
        password: 'short',
        password_confirm: 'short',
      }),
    ).toEqual({ password: AUTH_COPY.passwordTooShort })
  })

  it('rejects mismatched passwords', () => {
    expect(
      validateRegisterForm({
        email: 'masha@example.com',
        password: 'password12',
        password_confirm: 'password99',
      }),
    ).toEqual({ password_confirm: AUTH_COPY.passwordMismatch })
  })

  it('returns no errors for a valid payload', () => {
    const errors = validateRegisterForm({
      email: 'masha@example.com',
      password: 'password12',
      password_confirm: 'password12',
    })
    expect(hasAuthFieldErrors(errors)).toBe(false)
  })
})

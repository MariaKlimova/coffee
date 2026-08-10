import axios from 'axios'

import { AUTH_COPY, type AuthFieldName } from '../auth.const'
import type { AuthFieldErrors } from './validateAuthForm'

/**
 * Which auth form produced the request.
 */
export type AuthFormKind = 'login' | 'register'

/**
 * API Error schema payload used by the auth endpoints.
 */
interface ApiErrorBody {
  /** Human-readable summary. */
  detail?: string
  /** Machine-readable error code. */
  code?: string
  /** Optional field-level validation errors. */
  errors?: Partial<Record<string, string[]>>
}

/**
 * View-model for rendering auth API failures in the UI.
 */
export interface AuthErrorView {
  /** Message shown above the form (login failures, unknown errors). */
  formError?: string
  /** Field-level messages keyed by form field name. */
  fieldErrors: AuthFieldErrors
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

function mapFieldMessage(field: AuthFieldName, message: string): string {
  const lower = message.toLowerCase()
  if (field === 'email') {
    if (lower.includes('already exists')) {
      return AUTH_COPY.emailTaken
    }
    return AUTH_COPY.emailInvalid
  }
  if (field === 'password_confirm') {
    return AUTH_COPY.passwordMismatch
  }
  if (lower.includes('at least') || lower.includes('too short')) {
    return AUTH_COPY.passwordTooShort
  }
  return AUTH_COPY.passwordInvalid
}

/**
 * Maps an Axios/auth API error into Russian UI copy.
 */
export function mapAuthApiError(error: unknown, kind: AuthFormKind): AuthErrorView {
  if (!axios.isAxiosError(error)) {
    return { formError: AUTH_COPY.genericError, fieldErrors: {} }
  }

  const status = error.response?.status
  const data = (error.response?.data ?? {}) as ApiErrorBody

  if (kind === 'login' && status === 401) {
    return { formError: AUTH_COPY.loginFailed, fieldErrors: {} }
  }

  if (status === 400 && data.errors) {
    const fieldErrors: AuthFieldErrors = {}
    const fields: AuthFieldName[] = ['email', 'password', 'password_confirm']
    for (const field of fields) {
      const message = firstMessage(data.errors, field)
      if (message) {
        fieldErrors[field] = mapFieldMessage(field, message)
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors }
    }
  }

  return { formError: AUTH_COPY.genericError, fieldErrors: {} }
}

import { AUTH_COPY, PASSWORD_MIN_LENGTH, type AuthFieldName } from '../auth.const'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Values shared by the login form.
 */
export interface LoginFormValues {
  /** Email entered by the user. */
  email: string
  /** Password entered by the user. */
  password: string
}

/**
 * Values shared by the register form.
 */
export interface RegisterFormValues extends LoginFormValues {
  /** Password confirmation entered by the user. */
  password_confirm: string
}

export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>

function normalize(value: string): string {
  return value.trim()
}

function validateEmail(email: string): string | undefined {
  const value = normalize(email)
  if (!value) {
    return AUTH_COPY.emailRequired
  }
  if (!EMAIL_PATTERN.test(value)) {
    return AUTH_COPY.emailInvalid
  }
  return undefined
}

function validatePasswordRequired(password: string): string | undefined {
  if (!password) {
    return AUTH_COPY.passwordRequired
  }
  return undefined
}

function validatePasswordForRegister(password: string): string | undefined {
  const requiredError = validatePasswordRequired(password)
  if (requiredError) {
    return requiredError
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return AUTH_COPY.passwordTooShort
  }
  return undefined
}

/**
 * Client-side validation for the login form.
 * Password length is left to the API (OpenAPI LoginRequest has no minLength).
 */
export function validateLoginForm(values: LoginFormValues): AuthFieldErrors {
  const errors: AuthFieldErrors = {}
  const emailError = validateEmail(values.email)
  if (emailError) {
    errors.email = emailError
  }
  const passwordError = validatePasswordRequired(values.password)
  if (passwordError) {
    errors.password = passwordError
  }
  return errors
}

/**
 * Client-side validation for the register form.
 */
export function validateRegisterForm(values: RegisterFormValues): AuthFieldErrors {
  const errors: AuthFieldErrors = {}
  const emailError = validateEmail(values.email)
  if (emailError) {
    errors.email = emailError
  }
  const passwordError = validatePasswordForRegister(values.password)
  if (passwordError) {
    errors.password = passwordError
  }

  if (!values.password_confirm) {
    errors.password_confirm = AUTH_COPY.passwordConfirmRequired
  } else if (values.password !== values.password_confirm) {
    errors.password_confirm = AUTH_COPY.passwordMismatch
  }

  return errors
}

/**
 * True when the field-error map contains at least one message.
 */
export function hasAuthFieldErrors(errors: AuthFieldErrors): boolean {
  return Object.keys(errors).length > 0
}

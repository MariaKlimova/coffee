/**
 * Authenticated user profile returned by the auth API.
 */
export interface AuthUser {
  /** User UUID. */
  id: string
  /** Login email. */
  email: string
  /** Optional given name. */
  first_name?: string
  /** Optional family name. */
  last_name?: string
}

/**
 * Body for POST /api/auth/register/.
 */
export interface RegisterRequest {
  /** Unique email used as login. */
  email: string
  /** Password (min 8 characters on the backend). */
  password: string
  /** Must match password. */
  password_confirm: string
  /** Optional given name. */
  first_name?: string
  /** Optional family name. */
  last_name?: string
}

/**
 * Body for POST /api/auth/login/.
 */
export interface LoginRequest {
  /** Account email. */
  email: string
  /** Account password. */
  password: string
}

/**
 * Token pair returned by register/login.
 */
export interface AuthTokens {
  /** Short-lived JWT for Authorization header. */
  access: string
  /** Long-lived JWT used to obtain a new access token. */
  refresh: string
  /** Authenticated user profile. */
  user: AuthUser
}

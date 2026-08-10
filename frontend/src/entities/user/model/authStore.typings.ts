import type { AuthUser, LoginRequest, RegisterRequest } from '../api/authApi.typings'

/**
 * Lifecycle of the client auth session.
 */
export type AuthStatus = 'idle' | 'restoring' | 'authenticated' | 'guest'

/**
 * Payload stored after a successful login/register.
 */
export interface AuthSession {
  /** Short-lived JWT kept in memory. */
  accessToken: string
  /** Long-lived JWT also persisted to localStorage. */
  refreshToken: string
  /** Current user profile. */
  user: AuthUser
}

/**
 * Zustand auth store shape.
 */
export interface AuthStoreState {
  /** Session lifecycle marker. */
  status: AuthStatus
  /** Access JWT in memory, or null when logged out. */
  accessToken: string | null
  /** Refresh JWT mirrored to localStorage, or null. */
  refreshToken: string | null
  /** Current user, or null for guests. */
  user: AuthUser | null
  /** Applies tokens + user after login/register. */
  setSession: (session: AuthSession) => void
  /** Clears tokens, user, and localStorage. */
  clearSession: () => void
  /** Logs in via the API and stores the session. */
  login: (payload: LoginRequest) => Promise<void>
  /** Registers via the API and stores the session. */
  register: (payload: RegisterRequest) => Promise<void>
  /** Blacklists the refresh token (best-effort) and clears the session. */
  logout: () => Promise<void>
  /** Restores a session from a persisted refresh token via /me/. */
  restoreSession: () => Promise<void>
}

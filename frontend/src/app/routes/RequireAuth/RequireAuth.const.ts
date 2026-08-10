import type { Location } from 'react-router-dom'

/**
 * Location state written by RequireAuth before redirecting to /login.
 */
export interface AuthRedirectState {
  /** Original location the user tried to open. */
  from?: Location
}

/**
 * Resolves where to send the user after a successful login.
 */
export function getRedirectPath(state: unknown, fallback = '/'): string {
  if (!state || typeof state !== 'object') {
    return fallback
  }

  const from = (state as AuthRedirectState).from
  if (!from || typeof from.pathname !== 'string') {
    return fallback
  }

  const search = typeof from.search === 'string' ? from.search : ''
  const hash = typeof from.hash === 'string' ? from.hash : ''
  return `${from.pathname}${search}${hash}` || fallback
}

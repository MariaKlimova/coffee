import type { AuthStatus } from '@entities/user'

/**
 * Redirect to /login only when a live authenticated session expires mid-use.
 * Soft restore failures (stale refresh on F5) stay on the current public page.
 */
export function shouldRedirectOnSessionExpired(status: AuthStatus): boolean {
  return status === 'authenticated'
}

/**
 * SECURITY (MVP): refresh token lives in localStorage and is therefore
 * readable by any script on the origin (XSS). Move to an httpOnly cookie
 * once the backend supports it — see COFFEE-16.
 */
export const REFRESH_TOKEN_KEY = 'coffee.refresh_token'

export function readRefreshToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null
  }
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function writeRefreshToken(token: string): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function clearRefreshToken(): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

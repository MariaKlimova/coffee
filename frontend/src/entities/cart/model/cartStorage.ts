/**
 * SECURITY (MVP): гостевой токен корзины в localStorage (доступен XSS).
 * Для анонимной корзины допустимо; у авторизованных корзина идёт по JWT.
 */
export const CART_TOKEN_KEY = 'coffee.cart_token'

function canUseLocalStorage(): boolean {
  return (
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function' &&
    typeof localStorage.removeItem === 'function'
  )
}

export function readCartToken(): string | null {
  if (!canUseLocalStorage()) {
    return null
  }
  return localStorage.getItem(CART_TOKEN_KEY)
}

export function writeCartToken(token: string): void {
  if (!canUseLocalStorage()) {
    return
  }
  localStorage.setItem(CART_TOKEN_KEY, token)
}

export function clearCartTokenStorage(): void {
  if (!canUseLocalStorage()) {
    return
  }
  localStorage.removeItem(CART_TOKEN_KEY)
}

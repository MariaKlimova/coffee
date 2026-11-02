import { matchPath, type Location } from 'react-router-dom'

import { APP_ROUTES } from '@shared/config'

const RETURN_PATHS = [
  APP_ROUTES.home,
  APP_ROUTES.coffee,
  APP_ROUTES.machines,
  APP_ROUTES.product,
  APP_ROUTES.cart,
  APP_ROUTES.favorites,
  APP_ROUTES.checkout,
  APP_ROUTES.checkoutResult,
  APP_ROUTES.profile,
  APP_ROUTES.orders,
  APP_ROUTES.orderDetail,
  APP_ROUTES.manage,
  APP_ROUTES.manageProducts,
  APP_ROUTES.manageProductNew,
  APP_ROUTES.manageProductEdit,
]

/**
 * Состояние маршрута, сохранённое guard перед переходом к входу.
 */
export interface AuthRedirectState {
  /** Исходный адрес, который пользователь пытался открыть. */
  from?: Location
}

/**
 * Возвращает только известный внутренний адрес после успешного входа.
 */
export function getRedirectPath(state: unknown, fallback = '/'): string {
  if (!state || typeof state !== 'object') {
    return fallback
  }

  const from = (state as AuthRedirectState).from
  if (!from || typeof from !== 'object' || typeof from.pathname !== 'string') {
    return fallback
  }

  const search = typeof from.search === 'string' ? from.search : ''
  const hash = typeof from.hash === 'string' ? from.hash : ''
  const { pathname } = from
  const path = `${pathname}${search}${hash}`
  const hasUnsafeCharacter = Array.from(path).some(
    (character) =>
      character === '\\' ||
      character.charCodeAt(0) <= 32 ||
      character.charCodeAt(0) === 127,
  )
  if (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    (search !== '' && !search.startsWith('?')) ||
    search.includes('#') ||
    (hash !== '' && !hash.startsWith('#')) ||
    hasUnsafeCharacter ||
    !RETURN_PATHS.some((path) =>
      matchPath({ path, end: true, caseSensitive: true }, pathname),
    )
  ) {
    return fallback
  }

  // Нормализация URL не должна превращать путь в другой адрес или маршрут.
  const target = new URL(`${pathname}${search}${hash}`, 'https://coffee.invalid')
  if (target.origin !== 'https://coffee.invalid' || target.pathname !== pathname) {
    return fallback
  }
  return `${pathname}${search}${hash}`
}

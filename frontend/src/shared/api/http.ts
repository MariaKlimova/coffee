import axios, {
  CanceledError,
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

import { getAuthBridge } from './authBridge'
import type { AuthBridge } from './authBridge.typings'
import { getCartBridge } from './cartBridge'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

/** Заголовок гостевой корзины (OpenAPI `CartToken` / `XCartToken`). */
export const CART_TOKEN_HEADER = 'X-Cart-Token'

/** Paths that must never trigger a refresh retry on 401. */
const AUTH_SKIP_REFRESH_PATHS = [
  '/api/auth/login/',
  '/api/auth/register/',
  '/api/auth/refresh/',
]

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  /** Marks a request that already went through one refresh retry. */
  _retry?: boolean
  /** Исходная сессия запроса; closure не сериализует refresh JWT в config. */
  _isAuthSessionCurrent?: () => boolean
}

interface RefreshFlight {
  /** Bridge, от которого начался refresh. */
  bridge: AuthBridge
  /** Исходный refresh JWT; остаётся только внутри HTTP-модуля. */
  refreshToken: string | null
  /** Стабильный id сессии, если bridge поддерживает ротацию credentials. */
  sessionIdentity: string | number | undefined
  /** Общий результат только для этой сессии. */
  promise: Promise<string>
}

let refreshFlight: RefreshFlight | null = null

function isCurrentAuthSession(
  bridge: AuthBridge,
  refreshToken: string | null,
  sessionIdentity?: string | number,
): boolean {
  if (getAuthBridge() !== bridge) return false
  if (sessionIdentity !== undefined) {
    return bridge.getSessionIdentity?.() === sessionIdentity
  }
  return bridge.getRefreshToken() === refreshToken
}

function assertCurrentRequestSession(config: RetryableRequestConfig): void {
  if (config.signal?.aborted || config._isAuthSessionCurrent?.() === false) {
    throw new CanceledError('Authentication session changed or request was canceled')
  }
}

function shouldSkipRefresh(url: string | undefined): boolean {
  if (!url) {
    return false
  }
  return AUTH_SKIP_REFRESH_PATHS.some((path) => url.includes(path))
}

function isCartApiUrl(url: string | undefined): boolean {
  return Boolean(url?.includes('/api/cart/'))
}

function isCartMergeUrl(url: string | undefined): boolean {
  return Boolean(url?.includes('/api/cart/merge/'))
}

/** Гостевой checkout: заказ создаётся по существующему `X-Cart-Token`. */
function isGuestOrderCreateUrl(url: string | undefined): boolean {
  if (!url) {
    return false
  }
  // Только коллекция POST /api/orders/, не detail /api/orders/{id}/
  return /\/api\/orders\/?$/.test(url) || url.includes('/api/orders/?')
}

function shouldAttachGuestCartToken(url: string | undefined): boolean {
  if (isCartMergeUrl(url)) {
    return false
  }
  return isCartApiUrl(url) || isGuestOrderCreateUrl(url)
}

function readResponseCartToken(response: AxiosResponse): string | null {
  const headers = response.headers
  const fromHeader =
    headers[CART_TOKEN_HEADER.toLowerCase()] ?? headers[CART_TOKEN_HEADER]
  if (typeof fromHeader === 'string' && fromHeader.length > 0) {
    return fromHeader
  }

  const data = response.data
  if (data && typeof data === 'object' && 'cart_token' in data) {
    const bodyToken = (data as { cart_token?: unknown }).cart_token
    if (typeof bodyToken === 'string' && bodyToken.length > 0) {
      return bodyToken
    }
  }

  return null
}

async function refreshAccessToken(
  bridge: AuthBridge,
  refreshToken: string | null,
  sessionIdentity: string | number | undefined,
): Promise<string> {
  if (!refreshToken) {
    throw new Error('No refresh token')
  }
  const { data } = await axios.post<{ access: string }>(
    '/api/auth/refresh/',
    { refresh: refreshToken },
    { baseURL, headers: { Accept: 'application/json' } },
  )
  // Abort исходного GET не отменяет отдельный POST refresh. Поздний ответ
  // не вправе восстановить credentials после logout или поверх другого входа.
  if (!isCurrentAuthSession(bridge, refreshToken, sessionIdentity)) {
    throw new CanceledError('Authentication session changed during refresh')
  }
  bridge.onTokenRefreshed(data.access)
  return data.access
}

/**
 * Параллельные 401 одной сессии разделяют refresh; новая сессия имеет свой flight.
 * Поздние error/finally старого запроса не очищают ни новую сессию, ни её flight.
 */
function getSharedRefreshPromise(): Promise<string> {
  const bridge = getAuthBridge()
  const refreshToken = bridge.getRefreshToken()
  const sessionIdentity = bridge.getSessionIdentity?.()
  const sameFlightSession =
    sessionIdentity !== undefined
      ? refreshFlight?.sessionIdentity === sessionIdentity
      : refreshFlight?.sessionIdentity === undefined &&
        refreshFlight?.refreshToken === refreshToken
  if (refreshFlight?.bridge === bridge && sameFlightSession) {
    return refreshFlight.promise
  }
  const promise = refreshAccessToken(bridge, refreshToken, sessionIdentity)
    .catch((error: unknown) => {
      if (isCurrentAuthSession(bridge, refreshToken, sessionIdentity)) {
        bridge.onSessionExpired()
      }
      throw error
    })
    .finally(() => {
      if (refreshFlight?.promise === promise) {
        refreshFlight = null
      }
    })
  refreshFlight = { bridge, refreshToken, sessionIdentity, promise }
  return promise
}

export const http = axios.create({
  baseURL,
  headers: {
    Accept: 'application/json',
  },
})

http.interceptors.request.use((config: RetryableRequestConfig) => {
  const bridge = getAuthBridge()
  if (!config._isAuthSessionCurrent) {
    const refreshToken = bridge.getRefreshToken()
    const sessionIdentity = bridge.getSessionIdentity?.()
    config._isAuthSessionCurrent = () =>
      isCurrentAuthSession(bridge, refreshToken, sessionIdentity)
  }
  // Axios повторно запускает request interceptors после await refresh. Сессия
  // могла смениться уже после проверки response interceptor, перед отправкой.
  assertCurrentRequestSession(config)
  const accessToken = bridge.getAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
    return config
  }

  if (shouldAttachGuestCartToken(config.url)) {
    const cartToken = getCartBridge().getCartToken()
    if (cartToken && !config.headers.has(CART_TOKEN_HEADER)) {
      config.headers[CART_TOKEN_HEADER] = cartToken
    }
  }

  return config
})

http.interceptors.response.use(
  (response) => {
    if (isCartApiUrl(response.config.url)) {
      const cartToken = readResponseCartToken(response)
      if (cartToken) {
        getCartBridge().setCartToken(cartToken)
      }
    }
    return response
  },
  async (error: AxiosError) => {
    const original = error.config as RetryableRequestConfig | undefined
    if (!original || error.response?.status !== 401) {
      return Promise.reject(error)
    }

    if (original._retry || shouldSkipRefresh(original.url)) {
      return Promise.reject(error)
    }

    original._retry = true

    try {
      assertCurrentRequestSession(original)
      const access = await getSharedRefreshPromise()
      assertCurrentRequestSession(original)
      original.headers.Authorization = `Bearer ${access}`
      return http.request(original as AxiosRequestConfig)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)

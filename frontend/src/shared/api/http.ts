import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

import { getAuthBridge } from './authBridge'
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
}

let refreshPromise: Promise<string> | null = null

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

async function refreshAccessToken(): Promise<string> {
  const bridge = getAuthBridge()
  const refresh = bridge.getRefreshToken()
  if (!refresh) {
    throw new Error('No refresh token')
  }

  const { data } = await axios.post<{ access: string }>(
    `${baseURL}/api/auth/refresh/`,
    { refresh },
    {
      headers: { Accept: 'application/json' },
    },
  )

  bridge.onTokenRefreshed(data.access)
  return data.access
}

/**
 * Single-flight refresh: parallel 401s share one POST /refresh/.
 * onSessionExpired runs once if that shared refresh fails.
 */
function getSharedRefreshPromise(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .catch((error: unknown) => {
        getAuthBridge().onSessionExpired()
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export const http = axios.create({
  baseURL,
  headers: {
    Accept: 'application/json',
  },
})

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = getAuthBridge().getAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
    return config
  }

  if (isCartApiUrl(config.url) && !isCartMergeUrl(config.url)) {
    const cartToken = getCartBridge().getCartToken()
    if (cartToken) {
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
      const access = await getSharedRefreshPromise()
      original.headers.Authorization = `Bearer ${access}`
      return http.request(original as AxiosRequestConfig)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)

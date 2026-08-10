import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'

import { getAuthBridge } from './authBridge'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

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
  const token = getAuthBridge().getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
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

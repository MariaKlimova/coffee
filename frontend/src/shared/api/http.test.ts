import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetAuthBridge, setAuthBridge } from './authBridge'
import { resetCartBridge, setCartBridge } from './cartBridge'
import { CART_TOKEN_HEADER, http } from './http'

function jsonResponse(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
): AxiosResponse {
  return {
    data,
    status,
    statusText: String(status),
    headers,
    config,
  }
}

function unauthorizedError(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError(
    'Unauthorized',
    AxiosError.ERR_BAD_REQUEST,
    config,
    null,
    jsonResponse(config, 401, {
      detail: 'Token expired',
      code: 'token_not_valid',
    }),
  )
}

describe('http interceptors', () => {
  const adapter = vi.fn()
  const onSessionExpired = vi.fn()
  let accessToken: string | null = 'access-old'
  let refreshToken: string | null = 'refresh-valid'
  let cartToken: string | null = null
  const setCartToken = vi.fn((token: string) => {
    cartToken = token
  })

  beforeEach(() => {
    adapter.mockReset()
    onSessionExpired.mockReset()
    setCartToken.mockClear()
    accessToken = 'access-old'
    refreshToken = 'refresh-valid'
    cartToken = null
    http.defaults.adapter = adapter

    setAuthBridge({
      getAccessToken: () => accessToken,
      getRefreshToken: () => refreshToken,
      onTokenRefreshed: (token) => {
        accessToken = token
      },
      onSessionExpired,
    })

    setCartBridge({
      getCartToken: () => cartToken,
      setCartToken,
    })
  })

  afterEach(() => {
    resetAuthBridge()
    resetCartBridge()
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('attaches Authorization Bearer when an access token is present', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, { ok: true }),
    )

    await http.get('/api/health/')

    expect(adapter).toHaveBeenCalledTimes(1)
    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig
    expect(config.headers.Authorization).toBe('Bearer access-old')
  })

  it('attaches X-Cart-Token for guest cart requests', async () => {
    accessToken = null
    cartToken = 'guest-cart-token'

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        id: 'cart-1',
        items: [],
        total: '0.00',
        items_count: 0,
      }),
    )

    await http.get('/api/cart/')

    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig
    expect(config.headers.Authorization).toBeUndefined()
    expect(config.headers[CART_TOKEN_HEADER]).toBe('guest-cart-token')
  })

  it('does not attach X-Cart-Token when the user is authenticated', async () => {
    cartToken = 'guest-cart-token'

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        id: 'cart-1',
        items: [],
        total: '0.00',
        items_count: 0,
        cart_token: null,
      }),
    )

    await http.get('/api/cart/')

    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig
    expect(config.headers.Authorization).toBe('Bearer access-old')
    expect(config.headers[CART_TOKEN_HEADER]).toBeUndefined()
  })

  it('persists cart token from the response header', async () => {
    accessToken = null

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(
        config,
        200,
        { id: 'cart-1', items: [], total: '0.00', items_count: 0 },
        { [CART_TOKEN_HEADER.toLowerCase()]: 'new-guest-token' },
      ),
    )

    await http.get('/api/cart/')

    expect(setCartToken).toHaveBeenCalledWith('new-guest-token')
  })

  it('persists cart token from the response body when the header is absent', async () => {
    accessToken = null

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        id: 'cart-1',
        items: [],
        total: '0.00',
        items_count: 0,
        cart_token: 'body-guest-token',
      }),
    )

    await http.get('/api/cart/')

    expect(setCartToken).toHaveBeenCalledWith('body-guest-token')
  })

  it('refreshes on 401 and retries the original request', async () => {
    const postSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { access: 'access-new' },
    })

    adapter
      .mockImplementationOnce(async (config: InternalAxiosRequestConfig) => {
        throw unauthorizedError(config)
      })
      .mockImplementationOnce(async (config: InternalAxiosRequestConfig) =>
        jsonResponse(config, 200, { me: true }),
      )

    const { data } = await http.get('/api/auth/me/')

    expect(data).toEqual({ me: true })
    expect(postSpy).toHaveBeenCalledTimes(1)
    expect(accessToken).toBe('access-new')
    expect(adapter).toHaveBeenCalledTimes(2)
    const retryConfig = adapter.mock.calls[1][0] as InternalAxiosRequestConfig
    expect(retryConfig.headers.Authorization).toBe('Bearer access-new')
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('calls onSessionExpired once when shared refresh fails for parallel 401s', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh failed'))

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw unauthorizedError(config)
    })

    const results = await Promise.allSettled([http.get('/api/a/'), http.get('/api/b/')])

    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('does not refresh or expire session on 401 from auth endpoints', async () => {
    const postSpy = vi.spyOn(axios, 'post')

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw unauthorizedError(config)
    })

    await expect(
      http.post('/api/auth/login/', { email: 'a@b.c', password: 'x' }),
    ).rejects.toBeTruthy()
    await expect(
      http.post('/api/auth/register/', {
        email: 'a@b.c',
        password: 'password12',
        password_confirm: 'password12',
      }),
    ).rejects.toBeTruthy()
    await expect(
      http.post('/api/auth/refresh/', { refresh: 'broken' }),
    ).rejects.toBeTruthy()

    expect(postSpy).not.toHaveBeenCalled()
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('shares a single in-flight refresh across parallel 401s', async () => {
    let resolveRefresh!: (value: { data: { access: string } }) => void
    const refreshCall = new Promise<{ data: { access: string } }>((resolve) => {
      resolveRefresh = resolve
    })
    const postSpy = vi.spyOn(axios, 'post').mockReturnValue(refreshCall as never)

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.Authorization === 'Bearer access-new') {
        return jsonResponse(config, 200, { ok: true })
      }
      throw unauthorizedError(config)
    })

    const first = http.get('/api/a/')
    const second = http.get('/api/b/')

    await vi.waitFor(() => {
      expect(postSpy).toHaveBeenCalledTimes(1)
    })

    resolveRefresh({ data: { access: 'access-new' } })
    await expect(Promise.all([first, second])).resolves.toBeTruthy()
    expect(postSpy).toHaveBeenCalledTimes(1)
  })
})

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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

type RefreshResponse = { data: { access: string } }

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

  it('attaches X-Cart-Token for guest order create', async () => {
    accessToken = null
    cartToken = 'guest-cart-token'

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 201, { id: 'order-1' }),
    )

    await http.post('/api/orders/', { delivery_address: 'Москва' })

    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig
    expect(config.headers[CART_TOKEN_HEADER]).toBe('guest-cart-token')
  })

  it('does not attach X-Cart-Token to order detail for guests', async () => {
    accessToken = null
    cartToken = 'guest-cart-token'

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, { id: 'order-1' }),
    )

    await http.get('/api/orders/11111111-1111-1111-1111-111111111111/')

    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig
    expect(config.headers[CART_TOKEN_HEADER]).toBeUndefined()
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
    const [refreshUrl, refreshBody, refreshConfig] = postSpy.mock.calls[0]
    expect(refreshUrl).toBe('/api/auth/refresh/')
    expect(refreshBody).toEqual({ refresh: 'refresh-valid' })
    const refreshRequestUrl = axios.getUri({ ...refreshConfig, url: refreshUrl })
    const configuredBaseURL =
      import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
    const expectedRefreshUrl = new URL(
      'api/auth/refresh/',
      new URL(`${configuredBaseURL.replace(/\/$/, '')}/`, window.location.origin),
    )
    expect(new URL(refreshRequestUrl, window.location.origin).href).toBe(
      expectedRefreshUrl.href,
    )
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

  it('does not restore A credentials after logout and abort of the old GET', async () => {
    const gate = deferred<RefreshResponse>()
    const refresh = vi.spyOn(axios, 'post').mockReturnValue(gate.promise as never)
    const controller = new AbortController()
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.Authorization === 'Bearer access-old')
        throw unauthorizedError(config)
      if (config.headers.Authorization) return jsonResponse(config, 200, { owner: 'A' })
      throw new AxiosError(
        'Not found',
        '404',
        config,
        null,
        jsonResponse(config, 404, {}),
      )
    })
    const old = http
      .get('/api/orders/private-a/', { signal: controller.signal })
      .catch((error: unknown) => error)
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    accessToken = null
    refreshToken = null
    controller.abort()
    await expect(http.get('/api/orders/private-a/')).rejects.toMatchObject({
      response: { status: 404 },
    })
    gate.resolve({ data: { access: 'late-access-a' } })
    expect(axios.isCancel(await old)).toBe(true)
    expect(accessToken).toBeNull()
    expect(refreshToken).toBeNull()
    await expect(http.get('/api/orders/private-a/')).rejects.toMatchObject({
      response: { status: 404 },
    })
    expect(onSessionExpired).not.toHaveBeenCalled()
    expect(adapter.mock.calls.map(([config]) => config.headers.Authorization)).toEqual([
      'Bearer access-old',
      undefined,
      undefined,
    ])
  })

  it.each(['success', 'error'])(
    'does not replace or expire B on late refresh A %s',
    async (outcome) => {
      const gate = deferred<RefreshResponse>()
      const refresh = vi.spyOn(axios, 'post').mockReturnValue(gate.promise as never)
      adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (config.headers.Authorization === 'Bearer access-old')
          throw unauthorizedError(config)
        return jsonResponse(config, 200, { owner: 'B' })
      })
      const old = http.get('/api/orders/private-a/').catch((error: unknown) => error)
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
      accessToken = 'access-b'
      refreshToken = 'refresh-b'
      if (outcome === 'success') gate.resolve({ data: { access: 'late-access-a' } })
      else gate.reject(new Error('Late A refresh failed'))
      const error = await old
      expect(error).toBeInstanceOf(Error)
      if (outcome === 'success') expect(axios.isCancel(error)).toBe(true)
      expect(accessToken).toBe('access-b')
      expect(refreshToken).toBe('refresh-b')
      expect(onSessionExpired).not.toHaveBeenCalled()
      expect(adapter).toHaveBeenCalledTimes(1)
      await expect(http.get('/api/orders/private-b/')).resolves.toMatchObject({
        data: { owner: 'B' },
      })
      expect(adapter.mock.calls[1][0].headers.Authorization).toBe('Bearer access-b')
    },
  )

  it('does not start refresh B when an old A 401 arrives after switching sessions', async () => {
    const gate = deferred<void>()
    const refresh = vi.spyOn(axios, 'post')
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      await gate.promise
      throw unauthorizedError(config)
    })
    const old = http.get('/api/orders/private-a/').catch((error: unknown) => error)
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1))
    accessToken = 'access-b'
    refreshToken = 'refresh-b'
    gate.resolve()
    expect(axios.isCancel(await old)).toBe(true)
    expect(refresh).not.toHaveBeenCalled()
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('checks the original session again before a queued retry reaches the adapter', async () => {
    const refresh = vi
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { access: 'access-new' } })
    const beforeRetry = http.interceptors.request.use((config) => {
      if ((config as InternalAxiosRequestConfig & { _retry?: boolean })._retry) {
        accessToken = 'access-b'
        refreshToken = 'refresh-b'
      }
      return config
    })
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.Authorization === 'Bearer access-old')
        throw unauthorizedError(config)
      return jsonResponse(config, 200, { owner: 'B' })
    })
    try {
      await expect(http.get('/api/orders/private-a/')).rejects.toSatisfy(axios.isCancel)
      expect(adapter).toHaveBeenCalledTimes(1)
      expect(refresh).toHaveBeenCalledTimes(1)
      expect(accessToken).toBe('access-b')
      expect(refreshToken).toBe('refresh-b')
      expect(onSessionExpired).not.toHaveBeenCalled()
    } finally {
      http.interceptors.request.eject(beforeRetry)
    }
  })

  it('keeps B single-flight active when the older A flight finishes', async () => {
    const gateA = deferred<RefreshResponse>()
    const gateB = deferred<RefreshResponse>()
    const refresh = vi.spyOn(axios, 'post').mockImplementation((_url, body) => {
      return (body as { refresh: string }).refresh === 'refresh-valid'
        ? gateA.promise
        : gateB.promise
    })
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.Authorization === 'Bearer access-b-new')
        return jsonResponse(config, 200, { owner: 'B' })
      throw unauthorizedError(config)
    })
    const oldA = http.get('/api/orders/private-a/').catch((error: unknown) => error)
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    accessToken = 'access-b'
    refreshToken = 'refresh-b'
    const firstB = http.get('/api/orders/private-b/')
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
    gateA.resolve({ data: { access: 'late-access-a' } })
    expect(axios.isCancel(await oldA)).toBe(true)
    const secondB = http.get('/api/orders/private-b-again/')
    await vi.waitFor(() => {
      expect(
        (
          adapter.mock.calls[2]?.[0] as InternalAxiosRequestConfig & {
            _retry?: boolean
          }
        )._retry,
      ).toBe(true)
    })
    expect(refresh).toHaveBeenCalledTimes(2)
    gateB.resolve({ data: { access: 'access-b-new' } })
    await expect(Promise.all([firstB, secondB])).resolves.toHaveLength(2)
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(accessToken).toBe('access-b-new')
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('rejects late refresh when the source bridge is replaced even with the same token', async () => {
    const gate = deferred<RefreshResponse>()
    const refresh = vi.spyOn(axios, 'post').mockReturnValue(gate.promise as never)
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw unauthorizedError(config)
    })
    const old = http.get('/api/orders/private-a/').catch((error: unknown) => error)
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    const newTokenCallback = vi.fn()
    const newExpiryCallback = vi.fn()
    setAuthBridge({
      getAccessToken: () => 'access-b',
      getRefreshToken: () => 'refresh-valid',
      onTokenRefreshed: newTokenCallback,
      onSessionExpired: newExpiryCallback,
    })
    gate.resolve({ data: { access: 'late-access-a' } })
    expect(axios.isCancel(await old)).toBe(true)
    expect(accessToken).toBe('access-old')
    expect(newTokenCallback).not.toHaveBeenCalled()
    expect(newExpiryCallback).not.toHaveBeenCalled()
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('allows access rotation inside the same refresh session', async () => {
    const gate = deferred<RefreshResponse>()
    const refresh = vi.spyOn(axios, 'post').mockReturnValue(gate.promise as never)
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.Authorization === 'Bearer access-new')
        return jsonResponse(config, 200, { ok: true })
      throw unauthorizedError(config)
    })
    const request = http.get('/api/orders/private-a/')
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    accessToken = 'rotated-access-same-session'
    gate.resolve({ data: { access: 'access-new' } })
    await expect(request).resolves.toMatchObject({ data: { ok: true } })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('does not cancel the shared refresh when only one same-session GET is aborted', async () => {
    const gate = deferred<RefreshResponse>()
    const refresh = vi.spyOn(axios, 'post').mockReturnValue(gate.promise as never)
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.Authorization === 'Bearer access-new')
        return jsonResponse(config, 200, { ok: true })
      throw unauthorizedError(config)
    })
    const controller = new AbortController()
    const canceled = http
      .get('/api/orders/cancel/', { signal: controller.signal })
      .catch((error: unknown) => error)
    const active = http.get('/api/orders/active/')
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    controller.abort()
    gate.resolve({ data: { access: 'access-new' } })
    expect(axios.isCancel(await canceled)).toBe(true)
    await expect(active).resolves.toMatchObject({ data: { ok: true } })
    expect(accessToken).toBe('access-new')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onSessionExpired).not.toHaveBeenCalled()
  })
})

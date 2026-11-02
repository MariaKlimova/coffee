import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCartStore } from '@entities/cart'
import { orderKeys } from '@entities/order'
import { bindAuthBridge, useAuthStore } from '@entities/user'
import { http, resetAuthBridge } from '@shared/api'
import { ORDER_RESULT_COPY } from '@shared/lib/copy'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'

import { CheckoutResultPage } from '@pages/CheckoutResultPage'

import { AuthProvider } from './AuthProvider'

const orderId = '11111111-1111-1111-1111-111111111111'
const orderPath = `/api/orders/${orderId}/`
const user = {
  id: 'buyer-a',
  email: 'a@example.test',
  first_name: 'A',
  last_name: 'Coffee',
}

function response(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { config, data, status: 200, statusText: 'OK', headers: {} }
}

function reject(config: InternalAxiosRequestConfig, status: number): never {
  throw new AxiosError('Request rejected', String(status), config, undefined, {
    ...response(config, { detail: 'Not found', code: 'not_found' }),
    status,
  })
}

function order(status = 'payment_review', address = 'Guest address') {
  return {
    id: orderId,
    status,
    total: '500.00',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    delivery_address: address,
    items: [],
  }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function authenticate(
  id = user.id,
  refreshToken = 'refresh-a',
  accessToken = 'access-a',
) {
  useAuthStore.getState().setSession({
    user: { ...user, id },
    refreshToken,
    accessToken,
  })
}

function renderResult(
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity },
    },
  }),
) {
  return renderWithProviders(
    <AuthProvider>
      <CheckoutResultPage />
    </AuthProvider>,
    {
      queryClient,
      initialEntries: [`/checkout/result?order_id=${orderId}&payment=recovery`],
    },
  )
}

describe('CheckoutResultPage: session restoration and private query lifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useAuthStore.setState({
      status: 'idle',
      user: null,
      accessToken: null,
      refreshToken: null,
    })
    useCartStore.setState({ cartToken: null })
    bindAuthBridge()
  })

  afterEach(() => {
    cleanup()
    delete http.defaults.adapter
    resetAuthBridge()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('waits for /me 401 → refresh → /me 200 before authenticated return GET', async () => {
    useAuthStore.setState({ refreshToken: 'stored-refresh' })
    const gate = deferred()
    const refresh = vi.spyOn(axios, 'post').mockImplementation(async () => {
      await gate.promise
      return { data: { access: 'restored-access' } }
    })
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/auth/me/') {
        if (!config.headers.Authorization) reject(config, 401)
        expect(config.headers.Authorization).toBe('Bearer restored-access')
        return response(config, user)
      }
      if (config.url === orderPath) {
        if (config.headers.Authorization !== 'Bearer restored-access')
          reject(config, 404)
        return response(config, order())
      }
      throw new Error(`Unexpected ${config.url}`)
    })
    http.defaults.adapter = adapter
    renderResult()
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(useAuthStore.getState().status).toBe('restoring')
    expect(
      adapter.mock.calls.filter(([config]) => config.url === orderPath),
    ).toHaveLength(0)
    expect(
      screen.queryByRole('heading', { name: ORDER_RESULT_COPY.loadErrorTitle }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: ORDER_RESULT_COPY.loadingDescription }),
    ).toBeInTheDocument()
    await act(async () => {
      gate.resolve()
      await gate.promise
    })
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.reviewTitle }),
    ).toBeInTheDocument()
    expect(
      adapter.mock.calls.filter(([config]) => config.url === orderPath),
    ).toHaveLength(1)
    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(
      screen.queryByRole('button', { name: ORDER_RESULT_COPY.tryAgain }),
    ).not.toBeInTheDocument()
  })

  it('allows guest return only after failed restoration decides the guest session', async () => {
    useAuthStore.setState({ refreshToken: 'expired-refresh' })
    const gate = deferred()
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/auth/me/') {
        await gate.promise
        throw new Error('Restoration failed')
      }
      expect(config.url).toBe(orderPath)
      expect(config.headers.Authorization).toBeUndefined()
      return response(config, order('cancelled'))
    })
    http.defaults.adapter = adapter
    renderResult()
    await waitFor(() => expect(useAuthStore.getState().status).toBe('restoring'))
    expect(
      adapter.mock.calls.filter(([config]) => config.url === orderPath),
    ).toHaveLength(0)
    await act(async () => {
      gate.resolve()
      await gate.promise
    })
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.cancelledTitle }),
    ).toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('guest')
  })

  it('does not consume the payment polling timeout while restoration is pending', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    useAuthStore.setState({ status: 'restoring', refreshToken: 'waiting-refresh' })
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
      response(config, order('pending')),
    )
    http.defaults.adapter = adapter
    renderResult()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000)
    })
    expect(adapter).not.toHaveBeenCalled()
    await act(async () => {
      useAuthStore.getState().clearSession()
    })
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.recoveryTitle }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: ORDER_RESULT_COPY.delayedTitle }),
    ).not.toBeInTheDocument()
  })

  it('does not reuse an unscoped private cache for a guest with the same order UUID', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(
      orderKeys.detail(orderId),
      order('paid', 'Private buyer address'),
    )
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
      reject(config, 404),
    )
    http.defaults.adapter = adapter
    renderResult(client)
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.loadErrorTitle }),
    ).toBeInTheDocument()
    expect(adapter).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('heading', { name: ORDER_RESULT_COPY.successTitle }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Private buyer address')).not.toBeInTheDocument()
  })

  it('rechecks a guest 404 after login without reusing the stale error', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (!config.headers.Authorization) reject(config, 404)
      return response(config, order())
    })
    http.defaults.adapter = adapter
    renderResult()
    await screen.findByRole('heading', { name: ORDER_RESULT_COPY.loadErrorTitle })
    await act(async () => {
      authenticate()
    })
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.reviewTitle }),
    ).toBeInTheDocument()
    expect(adapter.mock.calls.map(([config]) => config.headers.Authorization)).toEqual([
      undefined,
      'Bearer access-a',
    ])
  })

  it.each(['logout', 'different-buyer', 'new-session-same-buyer'])(
    'discards the old in-flight private response after %s',
    async (transition) => {
      authenticate()
      const oldGate = deferred()
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
        if (config.headers.Authorization === 'Bearer access-a') {
          await oldGate.promise
          return response(config, order('paid', 'Old private address'))
        }
        reject(config, 404)
      })
      http.defaults.adapter = adapter
      const { queryClient } = renderResult()
      await waitFor(() => expect(adapter).toHaveBeenCalledTimes(1))
      await act(async () => {
        if (transition === 'logout') useAuthStore.getState().clearSession()
        else
          authenticate(
            transition === 'different-buyer' ? 'buyer-b' : user.id,
            'refresh-b',
            'access-b',
          )
      })
      expect(
        await screen.findByRole('heading', { name: ORDER_RESULT_COPY.loadErrorTitle }),
      ).toBeInTheDocument()
      expect(adapter.mock.calls[0][0].signal?.aborted).toBe(true)
      await act(async () => {
        oldGate.resolve()
        await oldGate.promise
      })
      expect(
        screen.queryByRole('heading', { name: ORDER_RESULT_COPY.successTitle }),
      ).not.toBeInTheDocument()
      expect(
        queryClient
          .getQueryCache()
          .findAll({ queryKey: orderKeys.all })
          .some((query) => query.state.data),
      ).toBe(false)
      const keys = JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      )
      expect(keys).not.toContain('access-a')
      expect(keys).not.toContain('refresh-a')
      expect(keys).not.toContain('access-b')
      expect(keys).not.toContain('refresh-b')
    },
  )

  it('removes already rendered private status immediately on logout before guest GET resolves', async () => {
    authenticate()
    const guestGate = deferred()
    http.defaults.adapter = async (config) => {
      if (config.headers.Authorization) return response(config, order('paid'))
      await guestGate.promise
      reject(config, 404)
    }
    renderResult()
    await screen.findByRole('heading', { name: ORDER_RESULT_COPY.successTitle })
    await act(async () => {
      useAuthStore.getState().clearSession()
    })
    expect(
      screen.queryByRole('heading', { name: ORDER_RESULT_COPY.successTitle }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: ORDER_RESULT_COPY.loadingDescription }),
    ).toBeInTheDocument()
    await act(async () => {
      guestGate.resolve()
      await guestGate.promise
    })
    await screen.findByRole('heading', { name: ORDER_RESULT_COPY.loadErrorTitle })
  })

  it('keeps same-session 401 refresh/retry and uses only Authorization headers', async () => {
    authenticate()
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'refreshed-access' } })
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      expect(config.url).toBe(orderPath)
      if (config.headers.Authorization === 'Bearer access-a') reject(config, 401)
      expect(config.headers.Authorization).toBe('Bearer refreshed-access')
      return response(config, order())
    })
    http.defaults.adapter = adapter
    const { router } = renderResult()
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.reviewTitle }),
    ).toBeInTheDocument()
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(useAuthStore.getState().accessToken).toBe('refreshed-access')
    expect(router.state.location.search).toBe(`?order_id=${orderId}&payment=recovery`)
  })
})

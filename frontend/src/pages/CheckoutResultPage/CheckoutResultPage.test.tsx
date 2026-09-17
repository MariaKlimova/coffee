import { QueryClient } from '@tanstack/react-query'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { cartKeys } from '@entities/cart'
import { useAuthStore } from '@entities/user'
import {
  ORDER_RESULT_POLL_TIMEOUT_MS,
  PENDING_ORDER_ID_KEY,
  writePendingOrderId,
} from '@features/checkout'
import { http } from '@shared/api'
import { ORDER_RESULT_COPY } from '@shared/lib/copy'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'

import { CheckoutResultPage } from './CheckoutResultPage'

function jsonResponse(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
): AxiosResponse {
  return {
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
  }
}

const orderId = '11111111-1111-1111-1111-111111111111'

function orderPayload(status: string) {
  return {
    id: orderId,
    status,
    total: '500.00',
    created_at: '2026-01-01T00:00:00Z',
    delivery_address: 'Москва',
    guest_email: 'guest@example.com',
    guest_phone: '+79001234567',
    items: [],
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function renderResult(initialPath: string, queryClient?: QueryClient) {
  return renderWithProviders(
    <Routes>
      <Route path="/checkout/result" element={<CheckoutResultPage />} />
      <Route path="/" element={<div>Home page</div>} />
    </Routes>,
    { initialEntries: [initialPath], queryClient },
  )
}

describe('CheckoutResultPage', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
    sessionStorage.clear()
    useAuthStore.setState({
      status: 'guest',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
    vi.useRealTimers()
  })

  afterEach(() => {
    delete http.defaults.adapter
    sessionStorage.clear()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows missing state when order id is absent', async () => {
    renderResult('/checkout/result')
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.missingTitle }),
    ).toBeInTheDocument()
  })

  it('resolves order id from sessionStorage when query is empty', async () => {
    writePendingOrderId(orderId)
    expect(sessionStorage.getItem(PENDING_ORDER_ID_KEY)).toBe(orderId)

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url?.includes(`/api/orders/${orderId}/`)) {
        return jsonResponse(config, 200, orderPayload('paid'))
      }
      if (config.url?.includes('/api/cart/')) {
        return jsonResponse(config, 200, {
          id: 'cart-1',
          items: [],
          total: '0.00',
          items_count: 0,
        })
      }
      throw new Error(`Unexpected ${config.url}`)
    })

    renderResult('/checkout/result')

    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.successTitle }),
    ).toBeInTheDocument()
    expect(screen.getByText(`Номер заказа: ${orderId}`)).toBeInTheDocument()
  })

  it('shows success for paid order from query and invalidates cart once', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url?.includes(`/api/orders/${orderId}/`)) {
        return jsonResponse(config, 200, orderPayload('paid'))
      }
      if (config.url?.includes('/api/cart/')) {
        return jsonResponse(config, 200, {
          id: 'cart-1',
          items: [],
          total: '0.00',
          items_count: 0,
        })
      }
      throw new Error(`Unexpected ${config.url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderResult(`/checkout/result?order_id=${orderId}`, queryClient)

    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.successTitle }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: ORDER_RESULT_COPY.goHome }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: cartKeys.all })
    })
    expect(sessionStorage.getItem(PENDING_ORDER_ID_KEY)).toBeNull()
  })

  it('shows auth CTA to orders on success', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token',
      refreshToken: 'refresh',
      user: {
        id: 'u1',
        email: 'a@b.c',
        first_name: 'A',
        last_name: 'B',
      },
    })
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url?.includes(`/api/orders/${orderId}/`)) {
        return jsonResponse(config, 200, orderPayload('paid'))
      }
      if (config.url?.includes('/api/cart/')) {
        return jsonResponse(config, 200, {
          id: 'cart-1',
          items: [],
          total: '0.00',
          items_count: 0,
        })
      }
      throw new Error(`Unexpected ${config.url}`)
    })

    renderResult(`/checkout/result?order_id=${orderId}`)

    expect(
      await screen.findByRole('link', { name: ORDER_RESULT_COPY.goToOrders }),
    ).toBeInTheDocument()
  })

  it('shows pending then delayed after poll timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url?.includes(`/api/orders/${orderId}/`)) {
        return jsonResponse(config, 200, orderPayload('pending'))
      }
      if (config.url?.includes('/api/cart/')) {
        return jsonResponse(config, 200, {
          id: 'cart-1',
          items: [],
          total: '0.00',
          items_count: 0,
        })
      }
      throw new Error(`Unexpected ${config.url}`)
    })

    renderResult(`/checkout/result?order_id=${orderId}`)

    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.pendingTitle }),
    ).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(ORDER_RESULT_POLL_TIMEOUT_MS)

    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.delayedTitle }),
    ).toBeInTheDocument()
  })

  it('retries payment on cancelled order', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url?.includes(`/api/orders/${orderId}/`)) {
        return jsonResponse(config, 200, orderPayload('cancelled'))
      }
      if (config.method === 'post' && config.url?.includes('/api/payments/create/')) {
        return jsonResponse(config, 201, {
          id: 'pay-1',
          order_id: orderId,
          status: 'pending',
          amount: '500.00',
          payment_url: 'https://pay.example/retry',
        })
      }
      if (config.url?.includes('/api/cart/')) {
        return jsonResponse(config, 200, {
          id: 'cart-1',
          items: [],
          total: '0.00',
          items_count: 0,
        })
      }
      throw new Error(`Unexpected ${config.url}`)
    })

    renderResult(`/checkout/result?order_id=${orderId}`)

    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.failedTitle }),
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: ORDER_RESULT_COPY.tryAgain }),
    )

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://pay.example/retry')
    })
    expect(sessionStorage.getItem(PENDING_ORDER_ID_KEY)).toBe(orderId)
  })

  it('shows load error with retry', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url?.includes(`/api/orders/${orderId}/`)) {
        throw new AxiosError(
          'fail',
          'ERR',
          config,
          undefined,
          jsonResponse(config, 404, { detail: 'not found', code: 'not_found' }),
        )
      }
      throw new Error(`Unexpected ${config.url}`)
    })

    renderResult(`/checkout/result?order_id=${orderId}`)

    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.loadErrorTitle }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: ORDER_RESULT_COPY.retryLoad }),
    ).toBeInTheDocument()
  })
})

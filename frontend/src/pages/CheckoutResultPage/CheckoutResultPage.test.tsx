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
  ORDER_RESULT_POLL_INTERVAL_MS,
  PENDING_ORDER_ID_KEY,
  writePendingOrderId,
  writePaymentRecoveryOrderId,
  readPaymentRecoveryOrderId,
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
    ).toHaveAttribute('href', '/orders')
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

  it.each(['cancelled', 'payment_review'])(
    'does not retry payment for %s',
    async (status) => {
      writePendingOrderId(orderId)
      adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (
          config.method === 'get' &&
          config.url?.includes(`/api/orders/${orderId}/`)
        ) {
          return jsonResponse(config, 200, orderPayload(status))
        }
        throw new Error(`Unexpected ${config.method} ${config.url}`)
      })
      renderResult(`/checkout/result?order_id=${orderId}`)
      const title =
        status === 'payment_review'
          ? ORDER_RESULT_COPY.reviewTitle
          : ORDER_RESULT_COPY.cancelledTitle
      expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
      const description =
        status === 'payment_review'
          ? ORDER_RESULT_COPY.reviewDescription
          : ORDER_RESULT_COPY.cancelledDescription
      expect(screen.getByText(description)).toBeInTheDocument()
      if (status === 'payment_review') {
        expect(
          screen.queryByText(ORDER_RESULT_COPY.cancelledDescription),
        ).not.toBeInTheDocument()
      }
      expect(
        screen.queryByRole('button', { name: ORDER_RESULT_COPY.tryAgain }),
      ).not.toBeInTheDocument()
      expect(sessionStorage.getItem(PENDING_ORDER_ID_KEY)).toBeNull()
      expect(adapter.mock.calls.every(([config]) => config.method === 'get')).toBe(true)
    },
  )

  it.each(['guest', 'authenticated'] as const)(
    'keeps a cancelled %s order out of saved payment recovery without promising a refund',
    async (authStatus) => {
      if (authStatus === 'authenticated') {
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
      }
      writePaymentRecoveryOrderId(orderId)
      adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (config.method === 'get' && config.url === `/api/orders/${orderId}/`) {
          return jsonResponse(config, 200, orderPayload('cancelled'))
        }
        throw new Error(`Unexpected ${config.method} ${config.url}`)
      })

      renderResult(`/checkout/result?order_id=${orderId}&payment=recovery`)

      expect(
        await screen.findByRole('heading', { name: ORDER_RESULT_COPY.cancelledTitle }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(ORDER_RESULT_COPY.cancelledDescription),
      ).toHaveTextContent('Если ты уже оплатил заказ')
      expect(
        screen.queryByRole('button', { name: ORDER_RESULT_COPY.tryAgain }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: ORDER_RESULT_COPY.successTitle }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('link', {
          name:
            authStatus === 'authenticated'
              ? ORDER_RESULT_COPY.goToOrders
              : ORDER_RESULT_COPY.goHome,
        }),
      ).toHaveAttribute('href', authStatus === 'authenticated' ? '/orders' : '/coffee')
      expect(readPaymentRecoveryOrderId()).toBeNull()
      expect(sessionStorage.getItem(PENDING_ORDER_ID_KEY)).toBeNull()
      expect(adapter.mock.calls.every(([config]) => config.method === 'get')).toBe(true)
    },
  )

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

  it('keeps a guest recovery order visible after retry also fails, including after reload', async () => {
    writePaymentRecoveryOrderId(orderId)
    let paymentCalls = 0
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url === `/api/orders/${orderId}/`) {
        return jsonResponse(config, 200, orderPayload('pending'))
      }
      if (config.method === 'post' && config.url === '/api/payments/create/') {
        paymentCalls += 1
        expect(JSON.parse(config.data)).toEqual({ order_id: orderId })
        throw new AxiosError('timeout', AxiosError.ECONNABORTED)
      }
      throw new Error(`Unexpected ${config.method} ${config.url}`)
    })
    const { unmount } = renderResult('/checkout/result')
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.recoveryTitle }),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: ORDER_RESULT_COPY.tryAgain }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      ORDER_RESULT_COPY.retryPaymentError,
    )
    expect(paymentCalls).toBe(1)
    expect(readPaymentRecoveryOrderId()).toBe(orderId)
    unmount()
    renderResult('/checkout/result')
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.recoveryTitle }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: ORDER_RESULT_COPY.tryAgain }),
    ).toBeEnabled()
    expect(paymentCalls).toBe(1)
  })

  it('does not offer payment recovery when the order cannot be accessed', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get') {
        throw new AxiosError(
          'not found',
          AxiosError.ERR_BAD_REQUEST,
          config,
          undefined,
          jsonResponse(config, 404, { detail: 'not found' }),
        )
      }
      throw new Error('No payment should be attempted')
    })
    renderResult(`/checkout/result?order_id=${orderId}&payment=recovery`)
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.loadErrorTitle }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: ORDER_RESULT_COPY.tryAgain }),
    ).not.toBeInTheDocument()
    expect(adapter.mock.calls.every(([config]) => config.method === 'get')).toBe(true)
  })

  it('clears saved recovery when the confirmed order is already paid', async () => {
    writePaymentRecoveryOrderId(orderId)
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, orderPayload('paid')),
    )
    renderResult(`/checkout/result?order_id=${orderId}&payment=recovery`)
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.successTitle }),
    ).toBeInTheDocument()
    expect(readPaymentRecoveryOrderId()).toBeNull()
    expect(sessionStorage.getItem(PENDING_ORDER_ID_KEY)).toBeNull()
    expect(
      screen.queryByRole('button', { name: ORDER_RESULT_COPY.tryAgain }),
    ).not.toBeInTheDocument()
  })

  it('updates recovery to paid if a timed-out provider request later completes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    writePaymentRecoveryOrderId(orderId)
    let orderReads = 0
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      orderReads += 1
      return jsonResponse(
        config,
        200,
        orderPayload(orderReads === 1 ? 'pending' : 'paid'),
      )
    })
    renderResult('/checkout/result')
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.recoveryTitle }),
    ).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(ORDER_RESULT_POLL_INTERVAL_MS)
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.successTitle }),
    ).toBeInTheDocument()
    expect(sessionStorage.getItem(PENDING_ORDER_ID_KEY)).toBeNull()
    expect(readPaymentRecoveryOrderId()).toBeNull()
  })
})

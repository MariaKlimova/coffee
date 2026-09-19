import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { useAuthStore } from '@entities/user'
import { PENDING_ORDER_ID_KEY } from '@features/checkout'
import { http } from '@shared/api'
import { ORDER_DETAIL_COPY } from '@shared/lib/copy'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'

import { OrderDetailPage } from './OrderDetailPage'

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

const orderPayload = {
  id: orderId,
  status: 'paid',
  total: '2580.00',
  created_at: '2026-09-19T10:00:00Z',
  delivery_address: 'Москва, ул. Пушкина, 1',
  guest_email: null,
  guest_phone: null,
  items: [
    {
      id: 'item-1',
      product_id: 'p1',
      product_name: 'Эфиопия Иргачеффе',
      product_price: '1290.00',
      quantity: 2,
    },
  ],
  updated_at: '2026-09-19T10:00:00Z',
}

function renderDetail(initialPath = `/orders/${orderId}`) {
  return renderWithProviders(
    <Routes>
      <Route path="/orders/:id" element={<OrderDetailPage />} />
      <Route path="/orders" element={<div>Orders list</div>} />
    </Routes>,
    { initialEntries: [initialPath] },
  )
}

describe('OrderDetailPage', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
    sessionStorage.clear()
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: {
        id: 'u1',
        email: 'a@b.c',
        first_name: 'A',
        last_name: 'B',
      },
    })
  })

  afterEach(() => {
    delete http.defaults.adapter
    sessionStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows snapshot items, address and total', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, orderPayload),
    )

    renderDetail()

    expect(
      await screen.findByRole('heading', { name: `Заказ ${orderId}` }),
    ).toBeInTheDocument()
    expect(screen.getByText('Эфиопия Иргачеффе')).toBeInTheDocument()
    expect(screen.getByText('2 шт.')).toBeInTheDocument()
    expect(screen.getByText('Москва, ул. Пушкина, 1')).toBeInTheDocument()
    expect(screen.getByText('Оплачен')).toBeInTheDocument()
    expect(screen.getByText(/2\s*580/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: ORDER_DETAIL_COPY.pay }),
    ).not.toBeInTheDocument()
  })

  it('shows not-found empty state on 404', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      const error = new AxiosError('Not found')
      error.config = config
      error.response = jsonResponse(config, 404, { detail: 'Not found' })
      error.status = 404
      return Promise.reject(error)
    })

    renderDetail()

    expect(await screen.findByText(ORDER_DETAIL_COPY.notFoundTitle)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: ORDER_DETAIL_COPY.backToOrders }),
    ).toHaveAttribute('href', '/orders')
  })

  it('pays a pending order via createPayment redirect', async () => {
    const user = userEvent.setup()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url?.includes(`/api/orders/${orderId}/`)) {
        return jsonResponse(config, 200, { ...orderPayload, status: 'pending' })
      }
      if (config.method === 'post' && config.url?.includes('/api/payments/create/')) {
        return jsonResponse(config, 201, {
          id: 'pay-1',
          order_id: orderId,
          status: 'pending',
          amount: '2580.00',
          payment_url: 'https://pay.example/from-orders',
        })
      }
      throw new Error(`Unexpected ${config.method} ${config.url}`)
    })

    renderDetail()

    const payButton = await screen.findByRole('button', {
      name: ORDER_DETAIL_COPY.pay,
    })
    await user.click(payButton)

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://pay.example/from-orders')
    })
    expect(sessionStorage.getItem(PENDING_ORDER_ID_KEY)).toBe(orderId)
  })
})

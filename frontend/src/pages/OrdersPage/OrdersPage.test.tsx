import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { useAuthStore } from '@entities/user'
import { http } from '@shared/api'
import { ORDERS_PAGE_COPY } from '@shared/lib/copy'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'

import { OrdersPage } from './OrdersPage'

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

const listItem = {
  id: '11111111-1111-1111-1111-111111111111',
  status: 'paid',
  total: '1290.00',
  created_at: '2026-09-19T10:00:00Z',
}

function renderOrders(initialPath = '/orders') {
  return renderWithProviders(
    <Routes>
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:id" element={<div>Order detail</div>} />
      <Route path="/coffee" element={<div>Каталог кофе</div>} />
    </Routes>,
    { initialEntries: [initialPath] },
  )
}

describe('OrdersPage', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
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
    vi.restoreAllMocks()
  })

  it('shows empty state when there are no orders', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        count: 0,
        next: null,
        previous: null,
        results: [],
      }),
    )

    renderOrders()

    expect(
      await screen.findByRole('heading', { name: ORDERS_PAGE_COPY.title }),
    ).toBeInTheDocument()
    expect(await screen.findByText(ORDERS_PAGE_COPY.emptyTitle)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: ORDERS_PAGE_COPY.goToCatalog }),
    ).toHaveAttribute('href', '/coffee')
  })

  it('renders order rows with status and total', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/api/orders/')) {
        return jsonResponse(config, 200, {
          count: 1,
          next: null,
          previous: null,
          results: [listItem],
        })
      }
      return jsonResponse(config, 404, { detail: 'Not found' })
    })

    renderOrders()

    expect(
      await screen.findByRole('link', {
        name: /Заказ 11111111-1111-1111-1111-111111111111/,
      }),
    ).toHaveAttribute('href', `/orders/${listItem.id}`)
    expect(screen.getByText('Оплачен')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/1\s*290/)).toBeInTheDocument()
    })
  })
})

import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { writeGuestOrderProof } from '@entities/order'
import { bindAuthBridge, useAuthStore } from '@entities/user'
import { http } from '@shared/api'
import { CANCELLATION_COPY as copy, ORDER_DETAIL_COPY } from '@shared/lib/copy'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'

import { OrderDetailPage } from './OrderDetailPage'

const originalAdapter = http.defaults.adapter
const a = 'synthetic-order-a'
const b = 'synthetic-order-b'
function data(id: string) {
  return {
    order: {
      id,
      status: 'pending',
      total: '500.00',
      created_at: '2026-11-05T10:00:00Z',
      updated_at: '2026-11-05T10:00:00Z',
      delivery_address: `Синтетический адрес ${id}`,
      items: [],
    },
    allowed_actions: ['cancel'],
    cancellation_requests: [],
  }
}
function response(config: InternalAxiosRequestConfig, value: unknown) {
  return {
    config,
    data: value,
    status: 200,
    statusText: '',
    headers: new AxiosHeaders(),
  }
}
function setup() {
  return renderWithProviders(
    <Routes>
      <Route path="/orders/:id" element={<OrderDetailPage />} />
    </Routes>,
    { initialEntries: [`/orders/${a}`] },
  )
}
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useAuthStore.setState({
    status: 'guest',
    user: null,
    accessToken: null,
    refreshToken: null,
    sessionGeneration: 71,
  })
  bindAuthBridge()
  for (const id of [a, b])
    writeGuestOrderProof({
      orderId: id,
      token: `synthetic-cap-${id}`,
      version: 1,
      checkoutRequestId: `synthetic-intent-${id}`,
      originalCartToken: `synthetic-cart-${id}`,
    })
})
afterEach(() => {
  http.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Смена карточки заказа в SPA', () => {
  it('подтверждение и причина A не появляются на B, неопределённое действие восстанавливается только на A', async () => {
    const posts: InternalAxiosRequestConfig[] = []
    http.defaults.adapter = async (config) => {
      if (config.method === 'get')
        return response(config, data(config.url?.includes(a) ? a : b))
      posts.push(config)
      expect(config.url).toBe(`/api/orders/${a}/cancel/`)
      expect(config.headers.get('X-Order-Action-Token')).toBe(`synthetic-cap-${a}`)
      if (posts.length === 1)
        throw new AxiosError('lost response', AxiosError.ERR_NETWORK, config)
      const current = {
        ...data(a),
        order: { ...data(a).order, status: 'cancelled' },
        allowed_actions: [],
      }
      return response(config, {
        order: current.order,
        buyer_actions: current,
        replayed: true,
      })
    }
    const view = setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: copy.cancel }))
    await user.type(screen.getByLabelText(copy.reason), 'Причина только заказа A')
    await act(async () => {
      await view.router.navigate(`/orders/${b}`)
    })
    await screen.findByRole('heading', { name: `Заказ ${b}` })
    expect(screen.queryByLabelText(copy.reason)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: copy.cancel }))
    expect(screen.getByLabelText(copy.reason)).toHaveValue('')
    await act(async () => {
      await view.router.navigate(`/orders/${a}`)
    })
    await user.click(await screen.findByRole('button', { name: copy.cancel }))
    await user.type(screen.getByLabelText(copy.reason), 'Подтверждённая причина A')
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    await screen.findByText(copy.uncertain)
    await act(async () => {
      await view.router.navigate(`/orders/${b}`)
    })
    await screen.findByRole('heading', { name: `Заказ ${b}` })
    expect(screen.queryByRole('button', { name: copy.retry })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: copy.cancel }))
    expect(screen.getByLabelText(copy.reason)).toHaveValue('')
    await act(async () => {
      await view.router.navigate(`/orders/${a}`)
    })
    const retry = await screen.findByRole('button', { name: copy.retry })
    await waitFor(() => expect(retry).toBeEnabled())
    expect(screen.getByLabelText(copy.reason)).toHaveValue('Подтверждённая причина A')
    await user.click(retry)
    await screen.findByText(copy.successCancel)
    expect(posts).toHaveLength(2)
    expect(posts[1].data).toBe(posts[0].data)
  })

  it('поздний GET A не открывает подтверждение и не меняет карточку B', async () => {
    let readsA = 0
    let release: (() => void) | undefined
    http.defaults.adapter = async (config) => {
      const id = config.url?.includes(a) ? a : b
      if (id === a && ++readsA === 2)
        await new Promise<void>((resolve) => {
          release = resolve
        })
      return response(config, data(id))
    }
    const view = setup()
    await userEvent.click(await screen.findByRole('button', { name: copy.cancel }))
    await waitFor(() => expect(release).toBeDefined())
    await act(async () => {
      await view.router.navigate(`/orders/${b}`)
    })
    await screen.findByRole('heading', { name: `Заказ ${b}` })
    await act(async () => {
      release?.()
      await Promise.resolve()
    })
    expect(screen.getByRole('heading', { name: `Заказ ${b}` })).toBeVisible()
    expect(screen.queryByLabelText(copy.reason)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: `Заказ ${a}` }),
    ).not.toBeInTheDocument()
  })

  it('поздняя платёжная сессия A не перенаправляет пользователя после открытия B', async () => {
    let release: (() => void) | undefined
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    http.defaults.adapter = async (config) => {
      if (config.method === 'get')
        return response(config, data(config.url?.includes(a) ? a : b))
      expect(JSON.parse(config.data).order_id).toBe(a)
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return response(config, {
        payment_url: 'https://synthetic-provider.invalid/order-a',
      })
    }
    const view = setup()
    await userEvent.click(
      await screen.findByRole('button', { name: ORDER_DETAIL_COPY.pay }),
    )
    await waitFor(() => expect(release).toBeDefined())
    await act(async () => {
      await view.router.navigate(`/orders/${b}`)
    })
    await screen.findByRole('heading', { name: `Заказ ${b}` })
    await act(async () => {
      release?.()
      await Promise.resolve()
    })
    expect(assign).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: ORDER_DETAIL_COPY.pay })).toBeEnabled()
  })
})

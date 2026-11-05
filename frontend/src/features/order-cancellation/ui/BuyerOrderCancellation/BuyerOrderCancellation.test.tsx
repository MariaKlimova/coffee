import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bindAuthBridge, useAuthStore } from '@entities/user'
import { writeGuestOrderProof, type BuyerActions } from '@entities/order'
import { OrderDetailPage } from '@pages/OrderDetailPage'
import { http } from '@shared/api'
import { CANCELLATION_COPY as copy, ORDER_DETAIL_COPY } from '@shared/lib/copy'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'

const id = 'synthetic-order-71'
const token = 'synthetic-private-capability-71'
const originalCartToken = 'synthetic-private-original-cart-71'
const originalAdapter = http.defaults.adapter
const initial: BuyerActions = {
  order: {
    id,
    status: 'pending',
    total: '500.00',
    created_at: '2026-11-05T10:00:00Z',
    updated_at: '2026-11-05T10:00:00Z',
    delivery_address: 'Синтетический адрес',
    items: [],
  },
  allowed_actions: ['cancel'],
  cancellation_requests: [],
}
function response(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: '', headers: new AxiosHeaders() }
}
function failure(config: InternalAxiosRequestConfig, status: number) {
  return new AxiosError(
    'synthetic transport',
    'ERR',
    config,
    { secret: token },
    { ...response(config, { code: 'order_status_conflict' }), status },
  )
}
function setup() {
  return renderWithProviders(
    <Routes>
      <Route path="/orders/:id" element={<OrderDetailPage />} />
    </Routes>,
    { initialEntries: [`/orders/${id}`] },
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
    sessionGeneration: 10,
  })
  bindAuthBridge()
  writeGuestOrderProof({
    orderId: id,
    token,
    version: 1,
    checkoutRequestId: 'synthetic-intent',
    originalCartToken,
  })
})
afterEach(() => {
  http.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('Покупательская отмена', () => {
  it('для оплаченного заказа отправляет причину сотруднику, оставляет статус и показывает один активный запрос', async () => {
    let current: BuyerActions = {
      ...initial,
      order: { ...initial.order, status: 'paid' },
      allowed_actions: ['request_cancellation'],
    }
    const posts: InternalAxiosRequestConfig[] = []
    http.defaults.adapter = async (config) => {
      if (config.method === 'get') return response(config, current)
      posts.push(config)
      expect(config.url).toBe(`/api/orders/${id}/cancellation-requests/`)
      const values = JSON.parse(config.data)
      expect(values.reason).toBe('Не подходит доставка')
      expect(values.expected_status).toBe('paid')
      current = {
        ...current,
        allowed_actions: [],
        cancellation_requests: [
          {
            id: 'synthetic-request',
            reason: values.reason,
            state: 'open',
            created_at: initial.order.created_at,
            decided_at: null,
            public_response: '',
          },
        ],
      }
      return response(config, {
        order: current.order,
        buyer_actions: current,
        replayed: false,
      })
    }
    setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: copy.request }))
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    expect(posts).toHaveLength(0)
    expect(screen.getByLabelText(copy.reason)).toBeRequired()
    await user.type(screen.getByLabelText(copy.reason), '  Не подходит доставка  ')
    await user.dblClick(screen.getByRole('button', { name: copy.confirm }))
    expect(await screen.findByText(copy.open)).toBeVisible()
    expect(posts).toHaveLength(1)
    expect(screen.getByText('Оплачен')).toBeVisible()
    expect(screen.queryByRole('button', { name: copy.request })).not.toBeInTheDocument()
    expect(screen.getByText(copy.refundHint)).toBeVisible()
  })

  it('старый отложенный POST не отправляется после смены покупателя на транспортной границе', async () => {
    let release: (() => void) | undefined
    let posts = 0
    http.defaults.adapter = async (config) => {
      if (config.method === 'post') posts++
      if (config.headers.Authorization) throw failure(config, 404)
      return response(config, initial)
    }
    const interceptor = http.interceptors.request.use(async (config) => {
      if (config.method === 'post')
        await new Promise<void>((resolve) => {
          release = resolve
        })
      return config
    })
    try {
      setup()
      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: copy.cancel }))
      await user.click(screen.getByRole('button', { name: copy.confirm }))
      await waitFor(() => expect(release).toBeDefined())
      act(() =>
        useAuthStore.getState().setSession({
          accessToken: 'synthetic-account',
          refreshToken: 'synthetic-refresh',
          user: { id: 'account-b', email: 'synthetic@example.invalid' },
        }),
      )
      await screen.findByText(copy.unavailable)
      await act(async () => {
        release?.()
        await Promise.resolve()
      })
      expect(posts).toBe(0)
    } finally {
      release?.()
      http.interceptors.request.eject(interceptor)
    }
  })

  it('гость без сохранённого права получает обращение в магазин без запроса по публичному UUID', async () => {
    localStorage.clear()
    const adapter = vi.fn()
    http.defaults.adapter = adapter
    setup()
    expect(await screen.findByText(copy.contact)).toBeVisible()
    expect(screen.getByRole('link', { name: copy.contactStore })).toHaveAttribute(
      'href',
      '#contacts',
    )
    expect(screen.getByRole('link', { name: copy.contactStore })).not.toHaveAttribute(
      'data-discover',
    )
    expect(adapter).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: copy.cancel })).not.toBeInTheDocument()
  })
  it('проверяет свежий статус до подтверждения и не отправляет отмену после отправки заказа', async () => {
    let reads = 0
    const posts: unknown[] = []
    http.defaults.adapter = async (config) => {
      if (config.method === 'post') posts.push(config.data)
      reads++
      return response(
        config,
        reads === 1
          ? initial
          : {
              ...initial,
              order: { ...initial.order, status: 'shipped' },
              allowed_actions: [],
            },
      )
    }
    setup()
    await userEvent.click(await screen.findByRole('button', { name: copy.cancel }))
    expect(await screen.findByText(copy.conflict)).toBeVisible()
    expect(screen.getByText('Отправлен')).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: copy.confirmCancel }),
    ).not.toBeInTheDocument()
    expect(posts).toHaveLength(0)
  })

  it('сохраняет UUID/причину после потерянного ответа и reload, повторяет точное действие', async () => {
    const posts: string[] = []
    let current = initial
    http.defaults.adapter = async (config) => {
      expect(config.headers.get('X-Order-Action-Token')).toBe(token)
      if (config.method === 'get') return response(config, current)
      posts.push(config.data)
      if (posts.length === 1) throw failure(config, 503)
      current = {
        ...initial,
        order: { ...initial.order, status: 'cancelled' },
        allowed_actions: [],
      }
      return response(config, {
        order: current.order,
        buyer_actions: current,
        replayed: true,
      })
    }
    const first = setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: copy.cancel }))
    await user.type(screen.getByLabelText(copy.reason), '  Изменились планы  ')
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    expect(await screen.findByText(copy.uncertain)).toBeVisible()
    first.unmount()
    setup()
    const retry = await screen.findByRole('button', { name: copy.retry })
    await waitFor(() => expect(retry).toBeEnabled())
    expect(screen.getByLabelText(copy.reason)).toHaveValue(
      '  Изменились планы  '.trim(),
    )
    await user.click(retry)
    expect(await screen.findByText(copy.successCancel)).toBeVisible()
    expect(posts).toHaveLength(2)
    expect(posts[1]).toBe(posts[0])
    expect(JSON.parse(posts[0]).reason).toBe('Изменились планы')
    expect(
      screen.queryByRole('button', { name: ORDER_DETAIL_COPY.pay }),
    ).not.toBeInTheDocument()
  })

  it.each([200, 404, 503])(
    'кэш приватного GET%s не содержит capability или исходную корзину, включая Axios error',
    async (status) => {
      http.defaults.adapter = async (config) => {
        if (status !== 200) throw failure(config, status)
        return response(config, initial)
      }
      const { queryClient } = setup()
      await waitFor(() =>
        expect(
          queryClient
            .getQueryCache()
            .getAll()
            .some((query) => query.state.status !== 'pending'),
        ).toBe(true),
      )
      const serialized = JSON.stringify({
        queries: queryClient
          .getQueryCache()
          .getAll()
          .map((query) => ({ key: query.queryKey, state: query.state })),
        mutations: queryClient
          .getMutationCache()
          .getAll()
          .map((mutation) => mutation.state),
      })
      expect(serialized).not.toContain(token)
      expect(serialized).not.toContain(originalCartToken)
      if (status !== 200) {
        const error = queryClient.getQueryCache().getAll()[0].state.error as AxiosError
        expect(error.config).toBeUndefined()
        expect(error.request).toBeUndefined()
        expect(
          error.response?.config.headers.get('X-Order-Action-Token'),
        ).toBeUndefined()
      }
    },
  )

  it('не показывает поздний результат и не отправляет гостевой секрет после входа в аккаунт', async () => {
    let release: (() => void) | undefined
    const guestPosts: string[] = []
    const accountHeaders: unknown[] = []
    http.defaults.adapter = async (config) => {
      if (config.headers.Authorization) {
        accountHeaders.push(config.headers.get('X-Order-Action-Token'))
        throw failure(config, 404)
      }
      if (config.method === 'get') return response(config, initial)
      guestPosts.push(config.data)
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return response(config, {
        order: { ...initial.order, status: 'cancelled' },
        buyer_actions: {
          ...initial,
          order: { ...initial.order, status: 'cancelled' },
          allowed_actions: [],
        },
        replayed: false,
      })
    }
    const { queryClient } = setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: copy.cancel }))
    await user.type(screen.getByLabelText(copy.reason), 'Прежняя причина')
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    await waitFor(() => expect(release).toBeDefined())
    act(() =>
      useAuthStore.getState().setSession({
        accessToken: 'synthetic-account-token',
        refreshToken: 'synthetic-refresh',
        user: { id: 'account-b', email: 'synthetic@example.invalid' },
      }),
    )
    expect(await screen.findByText(copy.unavailable)).toBeVisible()
    await act(async () => {
      release?.()
      await Promise.resolve()
    })
    expect(guestPosts).toHaveLength(1)
    expect(accountHeaders).toEqual([undefined])
    expect(screen.queryByText(copy.successCancel)).not.toBeInTheDocument()
    expect(screen.queryByText('Прежняя причина')).not.toBeInTheDocument()
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data),
      ),
    ).not.toContain('cancelled')
  })

  it('обращение оплаченного заказа показывает только публичный ответ и сохраняет оплаченный статус при отказе', async () => {
    const data = {
      ...initial,
      order: { ...initial.order, status: 'paid' },
      allowed_actions: [],
      cancellation_requests: [
        {
          id: 'request-71',
          reason: 'Не подходит доставка',
          state: 'declined',
          created_at: initial.order.created_at,
          decided_at: initial.order.updated_at,
          public_response: 'Заказ уже подготовлен, позвони нам',
          private_comment: 'INTERNAL-DO-NOT-RENDER',
          decided_by: { label: 'PRIVATE-STAFF' },
        },
      ],
    }
    http.defaults.adapter = async (config) => response(config, data)
    setup()
    expect(await screen.findByText('Заказ уже подготовлен, позвони нам')).toBeVisible()
    expect(screen.getByText('Оплачен')).toBeVisible()
    expect(screen.queryByText('INTERNAL-DO-NOT-RENDER')).not.toBeInTheDocument()
    expect(screen.queryByText('PRIVATE-STAFF')).not.toBeInTheDocument()
    expect(screen.getByText(copy.refundHint)).toBeVisible()
  })
})

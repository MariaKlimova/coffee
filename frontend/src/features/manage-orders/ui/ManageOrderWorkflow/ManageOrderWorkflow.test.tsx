import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RequireStaff } from '@app/routes/RequireStaff'
import { bindAuthBridge, useAuthStore } from '@entities/user'
import { ManageOrderDetailPage } from '@pages/ManageOrderDetailPage'
import { ManageOrdersPage } from '@pages/ManageOrdersPage'
import { http } from '@shared/api'
import { MANAGE_COPY, MANAGE_ORDERS_COPY as copy } from '@shared/lib/copy'

import type {
  AllowedOrderTransition,
  ManageOrder,
  OrderTransitionWrite,
} from '../../api/manageOrdersApi.typings'
import { ManageOrderWorkflow } from './ManageOrderWorkflow'

const originalAdapter = http.defaults.adapter
const id = 'b01cab61-0000-4000-8000-000000000061'
const endpoint = `/api/manage/orders/${id}/transitions/`
const processing: AllowedOrderTransition = {
  to_status: 'processing',
  inventory_effect: 'none',
  inventory_reason: null,
}
const cancellation: AllowedOrderTransition = {
  to_status: 'cancelled',
  inventory_effect: 'restore_stock',
  inventory_reason: null,
}
const shipped: AllowedOrderTransition = {
  to_status: 'shipped',
  inventory_effect: 'none',
  inventory_reason: null,
}
const initial: ManageOrder = {
  id,
  status: 'paid',
  total: '1200.00',
  latest_payment_status: 'succeeded',
  customer_email: 'synthetic@example.invalid',
  customer_phone: null,
  delivery_address: 'Синтетический адрес',
  created_at: '2026-11-05T08:00:00Z',
  updated_at: '2026-11-05T08:00:00Z',
  items: [],
  payments: [],
  allowed_transitions: [processing, cancellation],
  status_history: [],
}

function staff(actor = 'staff-a') {
  useAuthStore.getState().setSession({
    accessToken: `synthetic-${actor}`,
    refreshToken: `synthetic-refresh-${actor}`,
    user: { id: actor, email: `${actor}@example.invalid`, is_staff: true },
  })
}
function response(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: new AxiosHeaders() }
}
function failure(
  config: InternalAxiosRequestConfig,
  status: number,
  code = 'order_status_conflict',
) {
  return new AxiosError('synthetic failure', 'ERR', config, undefined, {
    ...response(config, { detail: 'synthetic', code }),
    status,
  })
}
function body(config: InternalAxiosRequestConfig): OrderTransitionWrite {
  return JSON.parse(config.data)
}
function changed(
  values: OrderTransitionWrite,
  overrides: Partial<ManageOrder> = {},
): ManageOrder {
  return {
    ...initial,
    status: values.to_status,
    allowed_transitions:
      values.to_status === 'processing' ? [shipped, cancellation] : [],
    status_history: [
      {
        id: values.request_id,
        from_status: values.expected_status,
        to_status: values.to_status,
        created_at: '2026-11-05T09:00:00Z',
        source: 'staff',
        actor: { id: 'staff-a', label: 'Сотрудник #staff-a' },
        comment: values.comment,
      },
    ],
    ...overrides,
  }
}
function setup(
  path = `/manage/orders/${id}?status=paid&page=2`,
  queryClient?: QueryClient,
) {
  const client =
    queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RequireStaff />}>
            <Route path="/manage/orders/:id" element={<ManageOrderDetailPage />} />
            <Route path="/manage/orders" element={<ManageOrdersPage />} />
          </Route>
          <Route path="/login" element={<p>synthetic login</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, ...view }
}
function install(initialOrder: ManageOrder = initial) {
  let current = structuredClone(initialOrder)
  const posts: InternalAxiosRequestConfig[] = []
  const reads: InternalAxiosRequestConfig[] = []
  http.defaults.adapter = async (config) => {
    if (config.method === 'post') {
      posts.push(config)
      current = changed(body(config))
      return response(config, { order: current, replayed: false })
    }
    reads.push(config)
    if (config.url === '/api/manage/orders/') {
      const results =
        config.params.status && config.params.status !== current.status ? [] : [current]
      return response(config, {
        results,
        count: results.length,
        next: null,
        previous: null,
      })
    }
    return response(config, current)
  }
  return { posts, reads }
}
async function choose(label: string = copy.takeProcessing) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: label }))
  return user
}

beforeEach(() => {
  staff()
  bindAuthBridge()
})
afterEach(() => {
  cleanup()
  http.defaults.adapter = originalAdapter
  useAuthStore.getState().clearSession()
  vi.restoreAllMocks()
})

describe('Обработка заказа сотрудником', () => {
  it('подтверждает серверное действие, отправляет trimmed комментарий и показывает реальную историю', async () => {
    const { posts } = install()
    setup()
    expect(await screen.findByText(copy.emptyHistory)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: copy.markShipped }),
    ).not.toBeInTheDocument()
    const user = await choose()
    expect(screen.getByRole('heading', { name: copy.confirmTitle })).toHaveFocus()
    await user.type(screen.getByLabelText(copy.comment), '  Проверила состав  ')
    expect(posts).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    expect(await screen.findByText(copy.transitionSuccess)).toBeVisible()
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe(endpoint)
    expect(body(posts[0])).toEqual({
      expected_status: 'paid',
      to_status: 'processing',
      comment: 'Проверила состав',
      request_id: expect.stringMatching(/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i),
    })
    expect(await screen.findByRole('button', { name: copy.markShipped })).toBeVisible()
    expect(screen.getByText('Сотрудник #staff-a')).toBeVisible()
    expect(screen.getByText('Проверила состав')).toBeVisible()
    expect(screen.getByRole('heading', { name: copy.workflow })).toHaveFocus()
    expect(screen.queryByText(copy.emptyHistory)).not.toBeInTheDocument()
  })

  it('отмена оплаченного заказа объясняет возврат товара и отдельный денежный возврат', async () => {
    const { posts } = install()
    setup()
    const user = await choose(copy.cancelOrder)
    expect(screen.getByText(copy.restoreStock)).toBeVisible()
    expect(screen.getByText(copy.separateRefund)).toBeVisible()
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    expect(await screen.findByText(copy.transitionSuccess)).toBeVisible()
    expect(posts.map((post) => post.url)).toEqual([endpoint])
    expect(body(posts[0]).to_status).toBe('cancelled')
    expect(screen.getByText(copy.noActions)).toBeVisible()
  })

  it('отмена обновляет detail и помечает текущие кэши остатков устаревшими без чужой сессии', async () => {
    install()
    const { client } = setup()
    const generation = useAuthStore.getState().sessionGeneration
    const catalogKey = ['manage-catalog', generation, 'staff-a', 'products']
    const otherCatalogKey = ['manage-catalog', generation - 1, 'staff-b', 'products']
    client.setQueryData(catalogKey, { syntheticStock: 1 })
    client.setQueryData(otherCatalogKey, { syntheticStock: 2 })
    client.setQueryData(['products', 'synthetic-list'], { syntheticStock: 1 })
    const user = await choose(copy.cancelOrder)
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    await screen.findByText(copy.transitionSuccess)
    expect(
      client.getQueryData<ManageOrder>([
        'manage-orders',
        generation,
        'staff-a',
        'detail',
        id,
      ])?.status,
    ).toBe('cancelled')
    expect(client.getQueryState(catalogKey)?.isInvalidated).toBe(true)
    expect(client.getQueryState(['products', 'synthetic-list'])?.isInvalidated).toBe(
      true,
    )
    expect(client.getQueryState(otherCatalogKey)?.isInvalidated).toBe(false)
  })

  it.each(['paid', 'pending'] as const)(
    'старый %s не обещает автоматического увеличения остатка',
    async (status) => {
      install({
        ...initial,
        status,
        allowed_transitions: [
          {
            ...cancellation,
            inventory_effect: 'none',
            inventory_reason: 'legacy_uncounted',
          },
        ],
      })
      setup()
      await choose(copy.cancelOrder)
      expect(screen.getByText(copy.legacyStock)).toBeVisible()
      expect(screen.queryByText(copy.restoreStock)).not.toBeInTheDocument()
      if (status === 'paid') expect(screen.getByText(copy.separateRefund)).toBeVisible()
      else expect(screen.queryByText(copy.separateRefund)).not.toBeInTheDocument()
    },
  )

  it('освобождение занятых товаров показывается по данным сервера', async () => {
    install({
      ...initial,
      status: 'pending',
      allowed_transitions: [
        { ...cancellation, inventory_effect: 'release_reservation' },
      ],
    })
    setup()
    await choose(copy.cancelOrder)
    expect(screen.getByText(copy.releaseReservation)).toBeVisible()
    expect(screen.queryByText(copy.separateRefund)).not.toBeInTheDocument()
  })

  it('отменённый заказ сохраняет предупреждение об отдельном возврате по любой успешной попытке', async () => {
    install({
      ...initial,
      status: 'cancelled',
      latest_payment_status: 'failed',
      allowed_transitions: [],
      payments: [
        {
          id: 'old-success',
          status: 'succeeded',
          amount: initial.total,
          created_at: initial.created_at,
          updated_at: initial.updated_at,
        },
      ],
    })
    setup()
    expect(await screen.findByText(copy.cancelledPaid)).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each(['delivered', 'cancelled', 'payment_review'] as const)(
    '%s не получает вымышленных действий',
    async (status) => {
      install({ ...initial, status, allowed_transitions: [] })
      setup()
      expect(
        await screen.findByText(
          status === 'payment_review' ? copy.manualReview : copy.noActions,
        ),
      ).toBeVisible()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    },
  )

  it('выход из подтверждения возвращает фокус и не создаёт запрос', async () => {
    const { posts } = install()
    setup()
    const user = await choose()
    await user.click(screen.getByRole('button', { name: copy.closeConfirmation }))
    expect(screen.getByRole('heading', { name: copy.workflow })).toHaveFocus()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(posts).toHaveLength(0)
  })

  it('неопределённый результат повторяет тот же UUID и тело, возвращая текущее состояние', async () => {
    const posts: OrderTransitionWrite[] = []
    let current = initial
    http.defaults.adapter = async (config) => {
      if (config.method !== 'post') return response(config, current)
      posts.push(body(config))
      if (posts.length === 1) {
        current = changed(posts[0], { status: 'shipped', allowed_transitions: [] })
        throw new AxiosError('synthetic connection lost', 'ERR_NETWORK', config)
      }
      return response(config, { order: current, replayed: true })
    }
    setup()
    const user = await choose()
    await user.type(screen.getByLabelText(copy.comment), 'Проверила')
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    expect(await screen.findByText(copy.transitionError)).toBeVisible()
    expect(screen.getByLabelText(copy.comment)).toBeDisabled()
    await user.click(screen.getByRole('button', { name: copy.retryTransition }))
    expect(await screen.findByText(copy.transitionReplay)).toBeVisible()
    expect(posts).toHaveLength(2)
    expect(posts[1]).toEqual(posts[0])
    expect(screen.getByText('Отправлен', { selector: 'span' })).toBeVisible()
  })

  it('обновление access token той же сессии повторяет POST с тем же UUID', async () => {
    const refresh = vi
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { access: 'synthetic-rotated-access' } })
    const posts: OrderTransitionWrite[] = []
    const authorization: unknown[] = []
    const generation = useAuthStore.getState().sessionGeneration
    let current = initial
    http.defaults.adapter = async (config) => {
      if (config.method !== 'post') return response(config, current)
      posts.push(body(config))
      authorization.push(config.headers.Authorization)
      if (posts.length === 1) throw failure(config, 401, 'token_not_valid')
      current = changed(posts[1])
      return response(config, { order: current, replayed: false })
    }
    setup()
    const user = await choose()
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    expect(await screen.findByText(copy.transitionSuccess)).toBeVisible()
    expect(refresh).toHaveBeenCalledOnce()
    expect(posts).toHaveLength(2)
    expect(posts[1]).toEqual(posts[0])
    expect(authorization).toEqual([
      'Bearer synthetic-staff-a',
      'Bearer synthetic-rotated-access',
    ])
    expect(useAuthStore.getState().sessionGeneration).toBe(generation)
  })

  it('проверка заказа после неопределённого результата не повторяет команду и снимает старое намерение', async () => {
    const posts: OrderTransitionWrite[] = []
    let current = initial
    http.defaults.adapter = async (config) => {
      if (config.method !== 'post') return response(config, current)
      posts.push(body(config))
      if (posts.length === 1) {
        current = changed(posts[0])
        throw failure(config, 503, 'unavailable')
      }
      current = changed(posts[1])
      return response(config, { order: current, replayed: false })
    }
    setup()
    const user = await choose()
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    await screen.findByText(copy.transitionError)
    await user.click(screen.getByRole('button', { name: copy.checkOrder }))
    expect(await screen.findByRole('button', { name: copy.markShipped })).toBeVisible()
    expect(posts).toHaveLength(1)
    await choose(copy.markShipped)
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    expect(await screen.findByText(copy.transitionSuccess)).toBeVisible()
    expect(posts[1].request_id).not.toBe(posts[0].request_id)
  })

  it.each(['order_status_conflict', 'transition_not_allowed', 'idempotency_conflict'])(
    '409 %s обновляет данные без успеха, сохраняет комментарий и требует нового подтверждения',
    async (code) => {
      let current = initial
      const posts: OrderTransitionWrite[] = []
      http.defaults.adapter = async (config) => {
        if (config.method !== 'post') return response(config, current)
        const values = body(config)
        posts.push(values)
        if (posts.length === 1) {
          current = { ...initial, status: 'processing', allowed_transitions: [shipped] }
          throw failure(config, 409, code)
        }
        current = changed(values)
        return response(config, { order: current, replayed: false })
      }
      setup()
      const user = await choose()
      await user.type(screen.getByLabelText(copy.comment), 'Черновик')
      await user.click(screen.getByRole('button', { name: copy.confirm }))
      expect(
        await screen.findByText(
          code === 'idempotency_conflict'
            ? copy.idempotencyConflict
            : copy.transitionConflict,
        ),
      ).toBeVisible()
      expect(screen.queryByText(copy.transitionSuccess)).not.toBeInTheDocument()
      expect(screen.queryByRole('form')).not.toBeInTheDocument()
      await user.click(await screen.findByRole('button', { name: copy.markShipped }))
      expect(screen.getByLabelText(copy.comment)).toHaveValue('Черновик')
      await user.click(screen.getByRole('button', { name: copy.confirm }))
      expect(await screen.findByText(copy.transitionSuccess)).toBeVisible()
      expect(posts[1].expected_status).toBe('processing')
      expect(posts[1].request_id).not.toBe(posts[0].request_id)
    },
  )

  it('синхронные повторные submit и ожидание не создают второй POST', async () => {
    let release: (() => void) | undefined
    let current = initial
    const posts: OrderTransitionWrite[] = []
    http.defaults.adapter = async (config) => {
      if (config.method !== 'post') return response(config, current)
      posts.push(body(config))
      await new Promise<void>((resolve) => {
        release = resolve
      })
      current = changed(posts[0])
      return response(config, { order: current, replayed: false })
    }
    setup()
    await choose()
    const form = screen.getByRole('form')
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(posts).toHaveLength(1))
    for (const button of within(form).getAllByRole('button'))
      expect(button).toBeDisabled()
    await act(async () => release?.())
    expect(await screen.findByText(copy.transitionSuccess)).toBeVisible()
  })

  it('409 и временная ошибка GET сохраняют черновик, запрещая новые действия до успешной проверки', async () => {
    let current = initial
    let readFails = false
    const posts: OrderTransitionWrite[] = []
    http.defaults.adapter = async (config) => {
      if (config.method === 'post') {
        const values = body(config)
        posts.push(values)
        if (posts.length === 1) {
          current = { ...initial, status: 'processing', allowed_transitions: [shipped] }
          readFails = true
          throw failure(config, 409)
        }
        current = changed(values)
        return response(config, { order: current, replayed: false })
      }
      if (readFails) throw failure(config, 503, 'unavailable')
      return response(config, current)
    }
    setup()
    const user = await choose()
    await user.type(
      screen.getByLabelText(copy.comment),
      'Сохранить черновик после сбоя',
    )
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    expect(await screen.findByText(copy.cachedOrder)).toBeVisible()
    expect(screen.getByRole('heading', { name: copy.number(id) })).toBeVisible()
    expect(screen.getByRole('button', { name: copy.takeProcessing })).toBeDisabled()
    expect(screen.getByRole('button', { name: copy.cancelOrder })).toBeDisabled()
    expect(screen.queryByText(copy.transitionSuccess)).not.toBeInTheDocument()
    expect(posts).toHaveLength(1)
    readFails = false
    await user.click(screen.getByRole('button', { name: copy.retry }))
    await choose(copy.markShipped)
    expect(screen.getByLabelText(copy.comment)).toHaveValue(
      'Сохранить черновик после сбоя',
    )
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    await screen.findByText(copy.transitionSuccess)
    expect(posts[1].expected_status).toBe('processing')
    expect(posts[1].request_id).not.toBe(posts[0].request_id)
  })

  it('неопределённый POST и неудачная проверка GET сохраняют точный UUID и тело до повтора', async () => {
    const posts: OrderTransitionWrite[] = []
    let readFails = false
    let current = initial
    http.defaults.adapter = async (config) => {
      if (config.method === 'post') {
        posts.push(body(config))
        if (posts.length === 1) {
          current = changed(posts[0])
          throw new AxiosError('synthetic lost response', 'ERR_NETWORK', config)
        }
        return response(config, { order: current, replayed: true })
      }
      if (readFails) throw failure(config, 500, 'unavailable')
      return response(config, current)
    }
    setup()
    const user = await choose()
    await user.type(screen.getByLabelText(copy.comment), '  Сохранить точный повтор  ')
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    await screen.findByText(copy.transitionError)
    readFails = true
    await user.click(screen.getByRole('button', { name: copy.checkOrder }))
    expect(await screen.findByText(copy.refreshError)).toBeVisible()
    expect(screen.getByRole('button', { name: copy.retryTransition })).toBeDisabled()
    expect(screen.getByLabelText(copy.comment)).toHaveValue(
      '  Сохранить точный повтор  ',
    )
    expect(screen.getByLabelText(copy.comment)).toBeDisabled()
    expect(screen.queryByText(copy.checkedOrder)).not.toBeInTheDocument()
    expect(posts).toHaveLength(1)
    readFails = false
    await user.click(screen.getByRole('button', { name: copy.retry }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: copy.retryTransition })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: copy.retryTransition }))
    expect(await screen.findByText(copy.transitionReplay)).toBeVisible()
    expect(posts).toHaveLength(2)
    expect(posts[1]).toEqual(posts[0])
    expect(posts[1].comment).toBe('Сохранить точный повтор')
  })

  it.each([401, 403, 404])(
    'GET %s после загруженной карточки скрывает приватные данные и сохранённый повтор',
    async (status) => {
      if (status === 401)
        vi.spyOn(axios, 'post').mockRejectedValue(
          new Error('synthetic expired refresh'),
        )
      let readFails = false
      http.defaults.adapter = async (config) => {
        if (config.method === 'post')
          throw new AxiosError('synthetic lost response', 'ERR_NETWORK', config)
        if (readFails) throw failure(config, status)
        return response(config, initial)
      }
      setup()
      const user = await choose()
      await user.type(screen.getByLabelText(copy.comment), 'Приватный черновик')
      await user.click(screen.getByRole('button', { name: copy.confirm }))
      await screen.findByText(copy.transitionError)
      readFails = true
      await user.click(screen.getByRole('button', { name: copy.checkOrder }))
      if (status === 401)
        expect(await screen.findByText('synthetic login')).toBeVisible()
      else
        expect(
          await screen.findByRole('heading', {
            name: status === 403 ? MANAGE_COPY.deniedTitle : copy.notFound,
          }),
        ).toBeVisible()
      expect(screen.queryByText(initial.customer_email!)).not.toBeInTheDocument()
      expect(screen.queryByText(initial.delivery_address)).not.toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: copy.number(id) }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('form')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: copy.retryTransition }),
      ).not.toBeInTheDocument()
      expect(screen.queryByText(copy.cachedOrder)).not.toBeInTheDocument()
    },
  )

  it('отклонённый Promise проверки обрабатывается без потери неопределённой команды', async () => {
    const posts: OrderTransitionWrite[] = []
    http.defaults.adapter = async (config) => {
      posts.push(body(config))
      if (posts.length === 1)
        throw new AxiosError('synthetic lost response', 'ERR_NETWORK', config)
      return response(config, { order: changed(posts[0]), replayed: true })
    }
    const refresh = vi.fn().mockRejectedValue(new Error('synthetic rejected refresh'))
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ManageOrderWorkflow
          order={initial}
          refreshing={false}
          verified
          refresh={refresh}
          onUnavailable={vi.fn()}
        />
      </QueryClientProvider>,
    )
    const user = await choose()
    await user.type(
      screen.getByLabelText(copy.comment),
      'Сохрани повтор при исключении',
    )
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    await screen.findByText(copy.transitionError)
    await user.click(screen.getByRole('button', { name: copy.checkOrder }))
    expect(await screen.findByText(copy.refreshError)).toBeVisible()
    expect(refresh).toHaveBeenCalledOnce()
    expect(screen.getByLabelText(copy.comment)).toHaveValue(
      'Сохрани повтор при исключении',
    )
    await user.click(screen.getByRole('button', { name: copy.retryTransition }))
    await screen.findByText(copy.transitionReplay)
    expect(posts[1]).toEqual(posts[0])
  })

  it.each([401, 403, 404])(
    'POST %s очищает только текущую карточку; следующий GET503 не возвращает приватный контекст',
    async (status) => {
      let reads = 0
      let denied = false
      if (status === 401)
        vi.spyOn(axios, 'post').mockResolvedValue({
          data: { access: 'synthetic-recovered' },
        })
      http.defaults.adapter = async (config) => {
        if (config.method === 'post') {
          denied = true
          throw failure(config, status)
        }
        reads++
        if (denied) throw failure(config, 503, 'unavailable')
        return response(config, initial)
      }
      const view = setup()
      const generation = useAuthStore.getState().sessionGeneration
      const detailKey = ['manage-orders', generation, 'staff-a', 'detail', id]
      const otherKey = ['manage-orders', generation - 1, 'staff-b', 'detail', id]
      view.client.setQueryData(otherKey, { syntheticOtherActor: true })
      const user = await choose()
      await user.type(screen.getByLabelText(copy.comment), 'Недоступный черновик')
      await user.click(screen.getByRole('button', { name: copy.confirm }))
      const title = status === 404 ? copy.notFound : MANAGE_COPY.deniedTitle
      expect(await screen.findByRole('heading', { name: title })).toBeVisible()
      expect(view.client.getQueryData(detailKey)).toBeUndefined()
      expect(view.client.getQueryData(otherKey)).toEqual({ syntheticOtherActor: true })
      await act(async () => {
        await view.client.invalidateQueries({ queryKey: detailKey })
      })
      expect(reads).toBe(1)
      // Имитируем сторонний повтор чтения: локальный отказ имеет приоритет над 503.
      await act(async () => {
        await expect(
          view.client.fetchQuery({
            queryKey: detailKey,
            retry: false,
            queryFn: async () => (await http.get(`/api/manage/orders/${id}/`)).data,
          }),
        ).rejects.toBeInstanceOf(AxiosError)
      })
      expect(screen.getByRole('heading', { name: title })).toBeVisible()
      expect(screen.queryByText(initial.customer_email!)).not.toBeInTheDocument()
      expect(screen.queryByRole('form')).not.toBeInTheDocument()
      expect(screen.queryByText(copy.cachedOrder)).not.toBeInTheDocument()
      view.unmount()
      setup(undefined, view.client)
      expect(await screen.findByRole('heading', { name: copy.error })).toBeVisible()
      expect(screen.queryByText(initial.customer_email!)).not.toBeInTheDocument()
    },
  )

  it.each(['staff-a', 'staff-b'])(
    'не отправляет отложенный POST после нового входа %s',
    async (nextActor) => {
      const { posts } = install()
      let release: (() => void) | undefined
      const interceptor = http.interceptors.request.use(async (config) => {
        if (config.method === 'post')
          await new Promise<void>((resolve) => {
            release = resolve
          })
        return config
      })
      try {
        setup()
        const user = await choose()
        await user.type(screen.getByLabelText(copy.comment), 'Прежняя сессия')
        await user.click(screen.getByRole('button', { name: copy.confirm }))
        await waitFor(() => expect(release).toBeDefined())
        act(() => staff(nextActor))
        expect(
          await screen.findByRole('button', { name: copy.takeProcessing }),
        ).toBeVisible()
        await act(async () => {
          release?.()
          await Promise.resolve()
        })
        expect(posts).toHaveLength(0)
        expect(screen.queryByText(copy.transitionSuccess)).not.toBeInTheDocument()
        await choose()
        expect(screen.getByLabelText(copy.comment)).toHaveValue('')
      } finally {
        release?.()
        http.interceptors.request.eject(interceptor)
      }
    },
  )

  it.each(['staff-a', 'staff-b'])(
    'поздний ответ старого POST не раскрывается в новой сессии %s',
    async (nextActor) => {
      let release: (() => void) | undefined
      http.defaults.adapter = async (config) => {
        if (config.method !== 'post') return response(config, initial)
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return response(config, { order: changed(body(config)), replayed: false })
      }
      const { client } = setup()
      const user = await choose()
      await user.type(
        screen.getByLabelText(copy.comment),
        'Приватный старый комментарий',
      )
      await user.click(screen.getByRole('button', { name: copy.confirm }))
      await waitFor(() => expect(release).toBeDefined())
      act(() => staff(nextActor))
      expect(
        await screen.findByRole('button', { name: copy.takeProcessing }),
      ).toBeVisible()
      await act(async () => {
        release?.()
        await Promise.resolve()
      })
      expect(screen.queryByText('Приватный старый комментарий')).not.toBeInTheDocument()
      expect(screen.queryByText(copy.transitionSuccess)).not.toBeInTheDocument()
      expect(
        client
          .getQueryCache()
          .getAll()
          .every(
            (query) => query.queryKey[1] === useAuthStore.getState().sessionGeneration,
          ),
      ).toBe(true)
      expect(
        JSON.stringify(
          client
            .getMutationCache()
            .getAll()
            .map((mutation) => mutation.state.data),
        ),
      ).not.toContain('Приватный')
    },
  )

  it('возврат к отфильтрованному списку получает текущее состояние после перехода', async () => {
    const { reads } = install()
    setup()
    const user = await choose()
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    await screen.findByText(copy.transitionSuccess)
    expect(screen.getByRole('link', { name: copy.back })).toHaveAttribute(
      'href',
      '/manage/orders?status=paid&page=2',
    )
    await user.click(screen.getByRole('link', { name: copy.back }))
    expect(await screen.findByText(copy.empty)).toBeVisible()
    expect(reads.at(-1)?.params).toMatchObject({ status: 'paid', page: 2 })
    expect(screen.queryByText(copy.number(id))).not.toBeInTheDocument()
  })

  it('уход из карточки во время POST не восстанавливает очищенный приватный detail', async () => {
    let release: (() => void) | undefined
    let current = initial
    http.defaults.adapter = async (config) => {
      if (config.method === 'post') {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        current = changed(body(config))
        return response(config, { order: current, replayed: false })
      }
      if (config.url === '/api/manage/orders/') {
        const results = current.status === 'paid' ? [current] : []
        return response(config, {
          results,
          count: results.length,
          next: null,
          previous: null,
        })
      }
      return response(config, current)
    }
    const { client } = setup()
    const user = await choose()
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    await waitFor(() => expect(release).toBeDefined())
    await user.click(screen.getByRole('link', { name: copy.back }))
    expect(await screen.findByRole('heading', { name: copy.title })).toBeVisible()
    await act(async () => {
      release?.()
      await Promise.resolve()
    })
    expect(await screen.findByText(copy.empty)).toBeVisible()
    expect(
      client
        .getQueryCache()
        .getAll()
        .filter((query) => query.queryKey.includes('detail')),
    ).toHaveLength(0)
  })

  it('история показывает системные источники, снимок удалённого автора и безопасный текст', async () => {
    const event = changed({
      expected_status: 'paid',
      to_status: 'processing',
      request_id: 'event-a',
      comment: '<img src=x onerror=alert(1)>',
    }).status_history[0]
    install({
      ...initial,
      allowed_transitions: [],
      status_history: [
        { ...event, actor: { id: null, label: 'Сотрудник #удалённый' } },
        { ...event, id: 'event-b', actor: null, source: 'payment', comment: '' },
        {
          ...event,
          id: 'event-c',
          actor: null,
          source: 'reservation_expiry',
          comment: '',
        },
      ],
    })
    const { container } = setup()
    expect(await screen.findByText(event.comment)).toBeVisible()
    expect(screen.getByText('Сотрудник #удалённый')).toBeVisible()
    expect(screen.getByText(copy.sourcePayment)).toBeVisible()
    expect(screen.getByText(copy.sourceExpiry)).toBeVisible()
    expect(container.querySelector('img')).toBeNull()
  })
})

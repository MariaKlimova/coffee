import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RequireStaff } from '@app/routes/RequireStaff'
import { ManageLayout } from '@app/layouts/ManageLayout'
import { bindAuthBridge, useAuthStore } from '@entities/user'
import { LoginPage } from '@pages/LoginPage'
import { ManageOrdersPage } from '@pages/ManageOrdersPage'
import { ManageOrderDetailPage } from '@pages/ManageOrderDetailPage'
import { http } from '@shared/api'
import { AUTH_COPY, MANAGE_COPY, MANAGE_ORDERS_COPY as copy } from '@shared/lib/copy'

import type { ManageOrder } from '../../api/manageOrdersApi.typings'

const originalAdapter = http.defaults.adapter
const id = 'ac2f449c-9de4-44be-a15f-12f258e74001'
const order: ManageOrder = {
  id,
  status: 'processing',
  latest_payment_status: 'failed',
  total: '751.00',
  customer_email: 'buyer@example.invalid',
  customer_phone: '+7 000 000-00-00',
  delivery_address: 'Тестовый город, длинный адрес\nВторая строка',
  created_at: '2026-01-02T00:30:00Z',
  updated_at: '2026-01-03T12:00:00Z',
  items: [
    {
      id: 'line-a',
      product_id: null,
      product_name: 'Исторический кофе',
      product_price: '375.50',
      quantity: 2,
    },
  ],
  payments: [
    {
      id: 'attempt-new',
      status: 'failed',
      amount: '751.00',
      created_at: '2026-01-03T10:30:00Z',
      updated_at: '2026-01-03T10:31:00Z',
    },
    {
      id: 'attempt-old',
      status: 'canceled',
      amount: '751.00',
      created_at: '2026-01-02T10:30:00Z',
      updated_at: '2026-01-02T10:31:00Z',
    },
  ],
}
function staff(userId = 'staff-a', canManage = true) {
  useAuthStore.getState().setSession({
    accessToken: `synthetic-${userId}`,
    refreshToken: `synthetic-refresh-${userId}`,
    user: { id: userId, email: `${userId}@example.invalid`, is_staff: canManage },
  })
}
function response(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: new AxiosHeaders() }
}
function error(config: InternalAxiosRequestConfig, status: number) {
  return new AxiosError('synthetic failure', 'ERR', config, undefined, {
    ...response(config, {}),
    status,
  })
}
function LocationProbe() {
  const location = useLocation()
  return (
    <output aria-label="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  )
}
function LoginProbe() {
  const { state } = useLocation()
  return (
    <p>
      login-return:{state?.from?.pathname}
      {state?.from?.search}
    </p>
  )
}
function setup(path = '/manage/orders', guarded = false, realLogin = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          {guarded ? (
            <Route element={<RequireStaff />}>
              <Route element={<ManageLayout />}>
                <Route path="/manage/orders" element={<ManageOrdersPage />} />
                <Route path="/manage/orders/:id" element={<ManageOrderDetailPage />} />
              </Route>
            </Route>
          ) : (
            <>
              <Route path="/manage/orders" element={<ManageOrdersPage />} />
              <Route path="/manage/orders/:id" element={<ManageOrderDetailPage />} />
            </>
          )}
          <Route path="/login" element={realLogin ? <LoginPage /> : <LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, ...view }
}
function installAdapter() {
  const calls: InternalAxiosRequestConfig[] = []
  http.defaults.adapter = async (config) => {
    calls.push(config)
    return response(
      config,
      config.url === '/api/manage/orders/'
        ? { results: [order], count: 1, next: null, previous: null }
        : order,
    )
  }
  return calls
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

describe('Обзор заказов сотрудника', () => {
  it.each([
    '/manage/orders?search=6060&page=2#results',
    `/manage/orders/${id}?search=6060#attempts`,
  ])(
    'после настоящей формы входа возвращается на %s и загружает staff данные',
    async (path) => {
      useAuthStore.getState().clearSession()
      const calls: InternalAxiosRequestConfig[] = []
      http.defaults.adapter = async (config) => {
        calls.push(config)
        if (config.url === '/api/auth/login/')
          return response(config, {
            access: 'synthetic-new-access',
            refresh: 'synthetic-new-refresh',
            user: {
              id: 'staff-return',
              email: 'staff-return@example.invalid',
              is_staff: true,
            },
          })
        return response(
          config,
          config.url === '/api/manage/orders/'
            ? { results: [order], count: 21, next: null, previous: 'previous-page' }
            : order,
        )
      }
      setup(path, true, true)
      expect(screen.getByRole('heading', { name: AUTH_COPY.loginTitle })).toBeVisible()
      expect(calls).toHaveLength(0)
      const user = userEvent.setup()
      await user.type(
        screen.getByLabelText(AUTH_COPY.emailLabel),
        'staff-return@example.invalid',
      )
      await user.type(
        screen.getByLabelText(AUTH_COPY.passwordLabel),
        'synthetic-password',
      )
      await user.click(screen.getByRole('button', { name: AUTH_COPY.loginSubmit }))
      expect(await screen.findByText(order.customer_email!)).toBeVisible()
      expect(screen.getByLabelText('location')).toHaveTextContent(path)
      expect(
        screen.queryByRole('heading', { name: AUTH_COPY.loginTitle }),
      ).not.toBeInTheDocument()
      expect(calls.map((call) => [call.method, call.url])).toEqual([
        ['post', '/api/auth/login/'],
        [
          'get',
          path.startsWith('/manage/orders?')
            ? '/api/manage/orders/'
            : `/api/manage/orders/${id}/`,
        ],
      ])
      expect(calls[1].headers.Authorization).toBe('Bearer synthetic-new-access')
    },
  )
  it('показывает отдельные статусы заказа и последней попытки оплаты без покупательских запросов', async () => {
    const calls = installAdapter()
    setup('/manage/orders', true)
    expect(await screen.findByText(copy.number(id))).toBeVisible()
    expect(within(screen.getByRole('list')).getByText('В обработке')).toBeVisible()
    expect(screen.getByText(`${copy.payment}: ${copy.paymentFailed}`)).toBeVisible()
    expect(screen.getByText(order.customer_email!)).toBeVisible()
    expect(screen.getByText(order.customer_phone!)).toBeVisible()
    expect(screen.getByText(/751,00/)).toBeVisible()
    expect(
      calls.every(
        (call) => call.method === 'get' && call.url?.startsWith('/api/manage/orders/'),
      ),
    ).toBe(true)
    expect(
      within(
        screen.getByRole('navigation', { name: MANAGE_COPY.navigation }),
      ).getByRole('link', { name: copy.title }),
    ).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: 'Оплатить' })).not.toBeInTheDocument()
  })
  it('применяет поиск/status/UTC-период, сохраняет фильтры в ссылке деталей и возвращается к той же странице', async () => {
    const calls = installAdapter()
    setup('/manage/orders?status=processing&page=2')
    const user = userEvent.setup()
    await screen.findByText(copy.number(id))
    await user.type(screen.getByLabelText(copy.search), 'buyer@example.invalid')
    await user.selectOptions(screen.getByLabelText(copy.status), 'paid')
    await user.type(screen.getByLabelText(copy.dateFrom), '2026-01-01')
    await user.type(screen.getByLabelText(copy.dateTo), '2026-01-03')
    await user.click(screen.getByRole('button', { name: copy.apply }))
    await waitFor(() =>
      expect(calls.at(-1)?.params).toMatchObject({
        search: 'buyer@example.invalid',
        status: 'paid',
        date_from: '2026-01-01',
        date_to: '2026-01-03',
        page: 1,
        page_size: 20,
      }),
    )
    const url = screen.getByLabelText('location').textContent!
    await user.click(screen.getByRole('link', { name: copy.number(id) }))
    expect(await screen.findByRole('heading', { name: copy.items })).toBeVisible()
    await user.click(screen.getByRole('link', { name: copy.back }))
    expect(await screen.findByRole('heading', { name: copy.title })).toBeVisible()
    expect(screen.getByLabelText('location')).toHaveTextContent(url)
    expect(screen.getByLabelText(copy.dateFrom)).toHaveValue('2026-01-01')
    expect(screen.getByLabelText(copy.search)).toHaveValue('buyer@example.invalid')
  })
  it('страницы сохраняют фильтры и обрабатывают недоступную страницу404', async () => {
    const pages: number[] = []
    http.defaults.adapter = async (config) => {
      pages.push(config.params.page)
      expect(config.params.status).toBe('paid')
      if (config.params.page > 2) throw error(config, 404)
      return response(config, {
        results: [order],
        count: 41,
        next: config.params.page === 1 ? 'next' : null,
        previous: null,
      })
    }
    setup('/manage/orders?status=paid&page=999')
    const user = userEvent.setup()
    await screen.findByText(copy.number(id))
    expect(pages).toEqual([999, 1])
    await user.click(screen.getByRole('button', { name: copy.next }))
    await waitFor(() =>
      expect(screen.getByLabelText('location')).toHaveTextContent('status=paid&page=2'),
    )
    await user.click(screen.getByRole('button', { name: copy.previous }))
    await waitFor(() =>
      expect(screen.getByLabelText('location')).toHaveTextContent(
        '/manage/orders?status=paid',
      ),
    )
    expect(pages).toEqual([999, 1, 2, 1])
  })
  it.each([403, 500])(
    'не сбрасывает страницу и не показывает устаревшие данные при ошибке%s',
    async (status) => {
      const reads = vi.fn()
      http.defaults.adapter = async (config) => {
        reads()
        throw error(config, status)
      }
      setup('/manage/orders?page=999&status=paid')
      expect(
        await screen.findByRole('heading', {
          name: status === 403 ? MANAGE_COPY.deniedTitle : copy.error,
        }),
      ).toBeVisible()
      expect(reads).toHaveBeenCalledOnce()
      expect(screen.getByLabelText('location')).toHaveTextContent('page=999')
      expect(screen.queryByText(copy.number(id))).not.toBeInTheDocument()
    },
  )
  it('показывает загрузку, ошибку с повтором, пустой результат и сброс фильтров', async () => {
    let release: (() => void) | undefined
    let fail = true
    http.defaults.adapter = async (config) => {
      if (fail) {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        throw error(config, 500)
      }
      return response(config, { results: [], count: 0, next: null, previous: null })
    }
    setup('/manage/orders?search=missing')
    expect(screen.getByText(copy.loading)).toBeVisible()
    await waitFor(() => expect(release).toBeDefined())
    await act(async () => release?.())
    expect(await screen.findByRole('heading', { name: copy.error })).toBeVisible()
    fail = false
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: copy.retry }))
    expect(await screen.findByRole('heading', { name: copy.empty })).toBeVisible()
    await user.click(screen.getAllByRole('button', { name: copy.reset })[0])
    expect(screen.getByLabelText('location')).toHaveTextContent('/manage/orders')
    expect(screen.getByLabelText(copy.search)).toHaveValue('')
  })
  it.each([
    'date_from=2026-02-30',
    'date_from=2026-02-02&date_to=2026-02-01',
    'status=unknown',
  ])('не отправляет невалидные фильтры URL %s', async (search) => {
    const calls = installAdapter()
    setup(`/manage/orders?${search}`)
    expect(screen.getByRole('alert')).toBeVisible()
    expect(calls).toHaveLength(0)
  })
  it.each(['guest', 'buyer', 'restoring'])(
    'права %s проверяются до запроса с сохранением login-return',
    async (mode) => {
      const calls = installAdapter()
      if (mode === 'guest') useAuthStore.getState().clearSession()
      if (mode === 'buyer') staff('buyer', false)
      if (mode === 'restoring') useAuthStore.setState({ status: 'restoring' })
      setup(`/manage/orders/${id}?status=paid&page=2`, true)
      if (mode === 'guest')
        expect(
          screen.getByText(`login-return:/manage/orders/${id}?status=paid&page=2`),
        ).toBeVisible()
      if (mode === 'buyer')
        expect(
          screen.getByRole('heading', { name: MANAGE_COPY.deniedTitle }),
        ).toBeVisible()
      if (mode === 'restoring') expect(screen.getByText('Загрузка…')).toBeVisible()
      expect(calls).toHaveLength(0)
    },
  )
  it.each([
    ['list', 'staff-b'],
    ['detail', 'staff-b'],
    ['list', 'staff-a'],
    ['detail', 'staff-a'],
  ])(
    'очищает %s при новом входе %s и отвергает поздний ответ прежнего поколения',
    async (mode, nextStaffId) => {
      let release: (() => void) | undefined
      let reads = 0
      http.defaults.adapter = async (config) => {
        const current = ++reads
        if (current === 1)
          await new Promise<void>((resolve) => {
            release = resolve
          })
        const next = {
          ...order,
          customer_email:
            current === 1
              ? 'old-private@example.invalid'
              : 'new-private@example.invalid',
        }
        return response(
          config,
          mode === 'list'
            ? { results: [next], count: 1, next: null, previous: null }
            : next,
        )
      }
      const { client } = setup(
        mode === 'list' ? '/manage/orders' : `/manage/orders/${id}`,
        true,
      )
      await waitFor(() => expect(release).toBeDefined())
      act(() => staff(nextStaffId))
      expect(await screen.findByText('new-private@example.invalid')).toBeVisible()
      await act(async () => {
        release?.()
        await Promise.resolve()
      })
      expect(screen.queryByText('old-private@example.invalid')).not.toBeInTheDocument()
      expect(
        client
          .getQueryCache()
          .getAll()
          .filter(
            (query) => query.queryKey[1] !== useAuthStore.getState().sessionGeneration,
          ),
      ).toHaveLength(0)
      act(() => useAuthStore.getState().clearSession())
      expect(screen.queryByText('new-private@example.invalid')).not.toBeInTheDocument()
      expect(
        client
          .getQueryCache()
          .getAll()
          .filter((query) => query.queryKey[0] === 'manage-orders'),
      ).toHaveLength(0)
    },
  )
  it.each(['staff-a', 'staff-b'])(
    'не отправляет отложенный staff GET после нового входа %s',
    async (nextStaffId) => {
      let release: (() => void) | undefined
      let first = true
      const gate = http.interceptors.request.use(async (config) => {
        if (first) {
          first = false
          await new Promise<void>((resolve) => {
            release = resolve
          })
        }
        return config
      })
      const calls = installAdapter()
      try {
        setup()
        await waitFor(() => expect(release).toBeDefined())
        act(() => staff(nextStaffId))
        await screen.findByText(copy.number(id))
        await act(async () => {
          release?.()
          await Promise.resolve()
        })
        expect(calls).toHaveLength(1)
        expect(calls[0].headers.Authorization).toBe(`Bearer synthetic-${nextStaffId}`)
      } finally {
        http.interceptors.request.eject(gate)
      }
    },
  )
  it('показывает снимки удалённых товаров и все безопасные попытки, без действий оплаты', async () => {
    const calls = installAdapter()
    setup(`/manage/orders/${id}?status=processing&page=2`)
    expect(await screen.findByText('Исторический кофе')).toBeVisible()
    expect(screen.getByText(copy.deletedProduct)).toBeVisible()
    expect(screen.getByText(/375,50.*2 шт/)).toBeVisible()
    expect(
      screen.getByText(order.delivery_address, { collapseWhitespace: false }),
    ).toBeVisible()
    expect(screen.getByText(copy.attempt('attempt-new'))).toBeVisible()
    expect(screen.getByText(copy.attempt('attempt-old'))).toBeVisible()
    expect(screen.getByRole('link', { name: copy.back })).toHaveAttribute(
      'href',
      '/manage/orders?status=processing&page=2',
    )
    expect(calls).toHaveLength(1)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('пустые контакты, состав и платежи имеют честные состояния', async () => {
    http.defaults.adapter = async (config) =>
      response(config, {
        ...order,
        customer_email: null,
        customer_phone: null,
        items: [],
        payments: [],
        delivery_address: '',
      })
    setup(`/manage/orders/${id}`)
    expect(await screen.findByText(copy.noItems)).toBeVisible()
    expect(screen.getByText(copy.noContact)).toBeVisible()
    expect(screen.getByText(copy.noPayment)).toBeVisible()
    expect(screen.getByText(copy.noAddress)).toBeVisible()
  })
  it.each([404, 403, 500])(
    'деталь: ошибка%s не раскрывает данные, ссылка назад сохраняет параметры',
    async (status) => {
      http.defaults.adapter = async (config) => {
        throw error(config, status)
      }
      setup(`/manage/orders/${id}?search=test&page=2`)
      let title: string = copy.error
      if (status === 404) title = copy.notFound
      if (status === 403) title = MANAGE_COPY.deniedTitle
      expect(await screen.findByRole('heading', { name: title })).toBeVisible()
      expect(screen.queryByText(order.customer_email!)).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: copy.back })).toHaveAttribute(
        'href',
        '/manage/orders?search=test&page=2',
      )
    },
  )
})

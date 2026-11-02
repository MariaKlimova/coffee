import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bindAuthBridge, useAuthStore } from '@entities/user'
import { ManageProductsPage } from '@pages/ManageProductsPage'
import { http } from '@shared/api'
import { MANAGE_COPY } from '@shared/lib/copy'

import type { CatalogState, ManageProduct } from '../../api/manageCatalogApi'

const originalAdapter = http.defaults.adapter
const product: ManageProduct = {
  id: 'product-a',
  slug: 'coffee-a',
  name: 'Кофе А',
  category: 'coffee',
  short_description: '',
  description: '',
  price: '450.00',
  old_price: null,
  in_stock: true,
  available_quantity: 3,
  stock_quantity: 5,
  reserved_quantity: 2,
  origin: 'owner',
  is_published: false,
  hidden_reason: 'unpublished',
  image_url: null,
  images: [],
  attributes: {},
  is_favorite: false,
  created_at: '',
  updated_at: '',
}
const state: CatalogState = {
  demo_enabled: true,
  switched_at: null,
  demo_product_count: 18,
  owner_product_count: 1,
  published_owner_product_count: 0,
}
function staff(id = 'staff-a') {
  useAuthStore.getState().setSession({
    accessToken: 'synthetic-access',
    refreshToken: 'synthetic-refresh',
    user: { id, email: `${id}@example.invalid`, is_staff: true },
  })
}
function response(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: new AxiosHeaders() }
}
function setup(path = '/manage/products') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ManageProductsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, ...view }
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

describe('Каталог владельца', () => {
  it('показывает загрузку, ошибку с повтором и пустой результат', async () => {
    let finish: (() => void) | undefined
    let fail = true
    http.defaults.adapter = async (config) => {
      if (config.url === '/api/manage/catalog/') return response(config, state)
      if (fail) {
        await new Promise<void>((resolve) => {
          finish = resolve
        })
        throw new Error('offline')
      }
      return response(config, { results: [], count: 0, next: null, previous: null })
    }
    setup()
    const user = userEvent.setup()
    expect(screen.getByRole('status')).toHaveTextContent('Загрузка каталога')
    await waitFor(() => expect(finish).toBeDefined())
    await act(async () => {
      finish?.()
    })
    expect(
      await screen.findByRole('heading', { name: 'Не удалось загрузить каталог' }),
    ).toBeVisible()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Попробовать ещё раз' }))
    expect(
      await screen.findByRole('heading', { name: 'Ничего не нашлось' }),
    ).toBeVisible()
  })
  it('показывает скрытый товар, количество, фильтры, страницы и переходы', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    http.defaults.adapter = async (config) => {
      requests.push(config)
      if (config.url === '/api/manage/catalog/') return response(config, state)
      return response(config, {
        results: [product],
        count: 21,
        next: '/api/manage/products/?page=2',
        previous: null,
      })
    }
    setup()
    const user = userEvent.setup()
    expect(await screen.findByText('Кофе А')).toBeVisible()
    expect(screen.getByText('Доступно к заказу: 3')).toBeVisible()
    expect(screen.getByText('Всего: 5. Занято заказами: 2.')).toBeVisible()
    expect(
      within(screen.getByRole('list')).getByText(MANAGE_COPY.unpublished),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: MANAGE_COPY.addProduct })).toHaveAttribute(
      'href',
      '/manage/products/new',
    )
    expect(screen.getByRole('link', { name: MANAGE_COPY.editProduct })).toHaveAttribute(
      'href',
      '/manage/products/product-a/edit',
    )
    await user.selectOptions(screen.getByLabelText(MANAGE_COPY.category), 'machines')
    await waitFor(() => expect(requests.at(-1)?.params.category).toBe('machines'))
    await user.selectOptions(screen.getByLabelText(MANAGE_COPY.publication), 'false')
    await user.type(screen.getByLabelText('Поиск'), 'капсулы')
    await user.click(screen.getByRole('button', { name: 'Найти' }))
    await waitFor(() =>
      expect(requests.at(-1)?.params).toMatchObject({
        category: 'machines',
        is_published: 'false',
        search: 'капсулы',
        page: 1,
        page_size: 20,
      }),
    )
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.nextPage }))
    await waitFor(() => expect(requests.at(-1)?.params.page).toBe(2))
  })

  it('сохраняет физическое количество и обновляет список и связанную витрину', async () => {
    let current = { ...product }
    const writes: unknown[] = []
    http.defaults.adapter = async (config) => {
      if (config.method === 'patch') {
        const body = JSON.parse(config.data)
        writes.push(body)
        current = {
          ...current,
          stock_quantity: body.stock_quantity,
          available_quantity: body.stock_quantity - 2,
        }
        return response(config, current)
      }
      return response(
        config,
        config.url === '/api/manage/catalog/'
          ? state
          : { results: [current], count: 1, next: null, previous: null },
      )
    }
    const { client } = setup()
    client.setQueryData(['products', 'detail', 'coffee-a'], product)
    client.setQueryData(['cart', 'detail'], {})
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: MANAGE_COPY.changeQuantity }),
    )
    await user.clear(screen.getByLabelText(MANAGE_COPY.physicalQuantity))
    await user.type(screen.getByLabelText(MANAGE_COPY.physicalQuantity), '7')
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
    expect(await screen.findByText('Доступно к заказу: 5')).toBeVisible()
    expect(writes).toEqual([{ stock_quantity: 7 }])
    expect(
      client.getQueryState(['products', 'detail', 'coffee-a'])?.isInvalidated,
    ).toBe(true)
    expect(client.getQueryState(['cart', 'detail'])?.isInvalidated).toBe(true)
  })

  it('не отправляет дробное/отрицательное количество и показывает конфликт резерва', async () => {
    const writes = vi.fn()
    http.defaults.adapter = async (config) => {
      if (config.method === 'patch') {
        writes()
        throw new AxiosError('bad', '400', config, undefined, {
          ...response(config, { errors: { stock_quantity: ['below reserved'] } }),
          status: 400,
        })
      }
      return response(
        config,
        config.url === '/api/manage/catalog/'
          ? state
          : { results: [product], count: 1, next: null, previous: null },
      )
    }
    setup()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: MANAGE_COPY.changeQuantity }),
    )
    const input = screen.getByLabelText(MANAGE_COPY.physicalQuantity)
    for (const value of ['-1', '1.5', '2147483648']) {
      await user.clear(input)
      await user.type(input, value)
      await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
      expect(screen.getByText(MANAGE_COPY.quantityInvalid)).toBeVisible()
    }
    expect(writes).not.toHaveBeenCalled()
    await user.clear(input)
    await user.type(input, '1')
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
    expect(await screen.findByText(MANAGE_COPY.quantityConflict)).toBeVisible()
    expect(writes).toHaveBeenCalledOnce()
  })

  it('требует явное согласие для сохранения изменений демо как своих', async () => {
    const writes: unknown[] = []
    http.defaults.adapter = async (config) => {
      if (config.method === 'patch') {
        writes.push(JSON.parse(config.data))
        return response(config, { ...product, origin: 'owner' })
      }
      return response(
        config,
        config.url === '/api/manage/catalog/'
          ? state
          : {
              results: [{ ...product, origin: 'demo' }],
              count: 1,
              next: null,
              previous: null,
            },
      )
    }
    setup()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: MANAGE_COPY.changeQuantity }),
    )
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
    expect(screen.getByText(MANAGE_COPY.demoConsentRequired)).toBeVisible()
    expect(writes).toEqual([])
    await user.click(screen.getByLabelText(MANAGE_COPY.demoConsent))
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
    await waitFor(() =>
      expect(writes).toEqual([{ stock_quantity: 5, save_as_owner: true }]),
    )
  })

  it('предупреждает о пустой витрине, не показывает ложный успех и повторяет cutover', async () => {
    let disabled = false
    let attempts = 0
    http.defaults.adapter = async (config) => {
      if (config.method === 'post') {
        attempts++
        if (attempts === 1) throw new Error('offline')
        disabled = true
        return response(config, { ...state, demo_enabled: false })
      }
      return response(
        config,
        config.url === '/api/manage/catalog/'
          ? { ...state, demo_enabled: !disabled }
          : { results: [product], count: 1, next: null, previous: null },
      )
    }
    setup()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: MANAGE_COPY.disableDemo }),
    )
    expect(screen.getByText(MANAGE_COPY.emptyFuture)).toBeVisible()
    expect(screen.getByText(MANAGE_COPY.confirmDescription(18, 1))).toBeVisible()
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.confirmDisable }))
    expect(await screen.findByText(MANAGE_COPY.cutoverError)).toBeVisible()
    expect(screen.queryByText(MANAGE_COPY.demoDisabled)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.confirmDisable }))
    expect(
      await screen.findByRole('heading', { name: MANAGE_COPY.demoDisabled }),
    ).toBeVisible()
    expect(attempts).toBe(2)
  })

  it('удаляет данные и не принимает поздний ответ предыдущего staff после нового входа', async () => {
    let finish: (() => void) | undefined
    let reads = 0
    http.defaults.adapter = async (config) => {
      if (config.url === '/api/manage/catalog/') return response(config, state)
      reads++
      const read = reads
      if (read === 1)
        await new Promise<void>((resolve) => {
          finish = resolve
        })
      return response(config, {
        results: [{ ...product, name: read === 1 ? 'Старые данные' : 'Новый каталог' }],
        count: 1,
        next: null,
        previous: null,
      })
    }
    const { client } = setup()
    await waitFor(() => expect(finish).toBeDefined())
    act(() => {
      useAuthStore.getState().clearSession()
      staff('staff-b')
    })
    expect(await screen.findByText('Новый каталог')).toBeVisible()
    await act(async () => {
      finish?.()
      await Promise.resolve()
    })
    expect(screen.queryByText('Старые данные')).not.toBeInTheDocument()
    expect(
      client
        .getQueryCache()
        .getAll()
        .filter((query) => query.queryKey[2] === 'staff-a'),
    ).toHaveLength(0)
    act(() => useAuthStore.getState().clearSession())
    expect(screen.queryByText('Новый каталог')).not.toBeInTheDocument()
  })

  it('после смены staff не отправляет отложенную мутацию с новым токеном', async () => {
    const writes = vi.fn()
    let release: (() => void) | undefined
    const gate = http.interceptors.request.use(async (config) => {
      if (config.method === 'patch')
        await new Promise<void>((resolve) => {
          release = resolve
        })
      return config
    })
    http.defaults.adapter = async (config) => {
      if (config.method === 'patch') writes()
      return response(
        config,
        config.url === '/api/manage/catalog/'
          ? state
          : { results: [product], count: 1, next: null, previous: null },
      )
    }
    try {
      const { client } = setup()
      const user = userEvent.setup()
      await user.click(
        await screen.findByRole('button', { name: MANAGE_COPY.changeQuantity }),
      )
      await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
      await waitFor(() => expect(release).toBeDefined())
      act(() => staff('staff-b'))
      const invalidation = vi.spyOn(client, 'invalidateQueries')
      await act(async () => {
        release?.()
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(writes).not.toHaveBeenCalled()
      expect(invalidation).not.toHaveBeenCalled()
      expect(screen.queryByText(MANAGE_COPY.saved)).not.toBeInTheDocument()
      expect(await screen.findByText('Кофе А')).toBeVisible()
    } finally {
      http.interceptors.request.eject(gate)
    }
  })

  it('поздний успешный ответ мутации старого staff не меняет кэш и сообщения новой сессии', async () => {
    let finish: (() => void) | undefined
    http.defaults.adapter = async (config) => {
      if (config.method === 'patch') {
        await new Promise<void>((resolve) => {
          finish = resolve
        })
        return response(config, {
          ...product,
          stock_quantity: 9,
          available_quantity: 7,
        })
      }
      return response(
        config,
        config.url === '/api/manage/catalog/'
          ? state
          : { results: [product], count: 1, next: null, previous: null },
      )
    }
    const { client } = setup()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: MANAGE_COPY.changeQuantity }),
    )
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
    await waitFor(() => expect(finish).toBeDefined())
    act(() => staff('staff-b'))
    expect(await screen.findByText('Доступно к заказу: 3')).toBeVisible()
    const invalidation = vi.spyOn(client, 'invalidateQueries')
    await act(async () => {
      finish?.()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(invalidation).not.toHaveBeenCalled()
    expect(screen.queryByText(MANAGE_COPY.saved)).not.toBeInTheDocument()
    expect(screen.queryByText('Доступно к заказу: 7')).not.toBeInTheDocument()
  })

  it('сохраняет демо как свой отдельным подтверждением и меняет публикацию своего товара', async () => {
    let current = { ...product, origin: 'demo' as 'demo' | 'owner' }
    const writes: unknown[] = []
    http.defaults.adapter = async (config) => {
      if (config.method === 'patch') {
        const body = JSON.parse(config.data)
        writes.push(body)
        current = { ...current, ...body, origin: 'owner' }
        return response(config, current)
      }
      return response(
        config,
        config.url === '/api/manage/catalog/'
          ? state
          : { results: [current], count: 1, next: null, previous: null },
      )
    }
    setup()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: MANAGE_COPY.saveAsOwner }),
    )
    expect(writes).toEqual([])
    const confirmation = screen.getByRole('region', { name: MANAGE_COPY.saveAsOwner })
    expect(within(confirmation).getByText(MANAGE_COPY.convertExplanation)).toBeVisible()
    await user.click(
      within(confirmation).getByRole('button', { name: MANAGE_COPY.saveAsOwner }),
    )
    expect(await screen.findByText(MANAGE_COPY.owner)).toBeVisible()
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.publish }))
    await waitFor(() =>
      expect(writes).toEqual([{ save_as_owner: true }, { is_published: true }]),
    )
    expect(await screen.findByRole('button', { name: MANAGE_COPY.hide })).toBeVisible()
  })
})

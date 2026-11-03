import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindAuthBridge, useAuthStore } from '@entities/user'
import { ManageProductCreatePage } from '@pages/ManageProductCreatePage'
import { ManageProductEditPage } from '@pages/ManageProductEditPage'
import { http } from '@shared/api'
import { MANAGE_COPY, PRODUCT_FORM_COPY as COPY } from '@shared/lib/copy'
import { ToastProvider } from '@shared/ui/Toast'
import type { ManageProduct } from '../../api/manageCatalogApi'

const originalAdapter = http.defaults.adapter
const product: ManageProduct = {
  id: 'product-a',
  slug: 'coffee-a',
  name: 'Кофе А',
  category: 'coffee',
  short_description: 'Мягкий вкус',
  description: 'Описание',
  price: '450.00',
  old_price: '500.00',
  in_stock: true,
  available_quantity: 3,
  stock_quantity: 5,
  reserved_quantity: 2,
  origin: 'owner',
  is_published: true,
  hidden_reason: null,
  image_url: '/real-photo.jpg',
  images: [{ url: '/real-photo.jpg', order: 0, is_main: true }],
  attributes: { country: 'Италия', intensity: 7 },
  is_favorite: false,
  created_at: '',
  updated_at: '',
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
function setup(path = '/manage/products/product-a/edit') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/manage/products/new" element={<ManageProductCreatePage />} />
            <Route
              path="/manage/products/:id/edit"
              element={<ManageProductEditPage />}
            />
            <Route path="/manage/products" element={<p>Список</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { ...view, client }
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
async function fillNew() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(COPY.name), 'Новый товар')
  await user.type(screen.getByLabelText(COPY.shortDescription), 'Краткое описание')
  await user.type(screen.getByLabelText(COPY.price), '450,50')
  await user.clear(screen.getByLabelText(MANAGE_COPY.physicalQuantity))
  await user.type(screen.getByLabelText(MANAGE_COPY.physicalQuantity), '3')
  return user
}

describe('Форма товара без галереи', () => {
  it.each(['coffee', 'machines'] as const)(
    'создаёт %s с тремя единицами и открывает сохранённый edit',
    async (category) => {
      const writes: unknown[] = []
      let current = { ...product }
      http.defaults.adapter = async (config) => {
        if (config.method === 'post') {
          const body = JSON.parse(config.data)
          writes.push(body)
          current = {
            ...product,
            ...body,
            stock_quantity: 3,
            available_quantity: 3,
            reserved_quantity: 0,
          }
        }
        return response(config, current)
      }
      const { client } = setup('/manage/products/new')
      const user = await fillNew()
      if (category === 'machines') {
        await user.selectOptions(
          screen.getByLabelText(MANAGE_COPY.category),
          'machines',
        )
        await user.click(screen.getByRole('button', { name: COPY.confirmCategory }))
        await user.type(screen.getByLabelText(COPY.power_w), '1200')
      } else await user.type(screen.getByLabelText(COPY.intensity), '8')
      const invalidate = vi.spyOn(client, 'invalidateQueries')
      await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
      expect(await screen.findByText(COPY.created)).toBeVisible()
      expect(
        await screen.findByRole('heading', { name: MANAGE_COPY.editTitle }),
      ).toBeVisible()
      expect(screen.getByLabelText(MANAGE_COPY.physicalQuantity)).toHaveValue('3')
      expect(writes).toEqual([
        {
          name: 'Новый товар',
          category,
          short_description: 'Краткое описание',
          description: '',
          price: '450.50',
          old_price: null,
          stock_quantity: 3,
          is_published: true,
          attributes: category === 'coffee' ? { intensity: 8 } : { power_w: 1200 },
        },
      ])
      for (const key of ['products', 'cart', 'favorites'])
        expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] })
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['manage-catalog', expect.any(Number), 'staff-a'],
      })
    },
  )

  it('редактирует поля, снимает с витрины и не отправляет фотографии или серверные счётчики', async () => {
    const writes: unknown[] = []
    let current = product
    http.defaults.adapter = async (config) => {
      if (config.method === 'patch') {
        const body = JSON.parse(config.data)
        writes.push(body)
        current = { ...current, ...body }
      }
      return response(config, current)
    }
    const view = setup()
    const user = userEvent.setup()
    await user.clear(await screen.findByLabelText(COPY.name))
    await user.type(screen.getByLabelText(COPY.name), 'Изменённое имя')
    await user.click(screen.getByLabelText(COPY.publication))
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
    expect(await screen.findByText(MANAGE_COPY.saved)).toBeVisible()
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ name: 'Изменённое имя', is_published: false })
    expect(writes[0]).not.toHaveProperty('images')
    expect(writes[0]).not.toHaveProperty('reserved_quantity')
    expect(current.images).toEqual(product.images)
    view.unmount()
    setup()
    expect(await screen.findByLabelText(COPY.name)).toHaveValue('Изменённое имя')
    expect(screen.getByLabelText(COPY.publication)).not.toBeChecked()
  })

  it('предупреждает о смене категории, отменяет её или очищает только характеристики', async () => {
    http.defaults.adapter = async (config) => response(config, product)
    setup()
    const user = userEvent.setup()
    await screen.findByLabelText(COPY.name)
    await user.selectOptions(screen.getByLabelText(MANAGE_COPY.category), 'machines')
    expect(screen.getByLabelText(COPY.country)).toHaveValue('Италия')
    await user.click(
      within(screen.getByRole('region', { name: COPY.changeCategory })).getByRole(
        'button',
        { name: MANAGE_COPY.cancel },
      ),
    )
    expect(screen.getByLabelText(MANAGE_COPY.category)).toHaveValue('coffee')
    await user.selectOptions(screen.getByLabelText(MANAGE_COPY.category), 'machines')
    await user.click(screen.getByRole('button', { name: COPY.confirmCategory }))
    expect(screen.queryByLabelText(COPY.country)).not.toBeInTheDocument()
    expect(screen.getByLabelText(COPY.manufacturer_country)).toHaveValue('')
    expect(screen.getByLabelText(COPY.name)).toHaveValue(product.name)
    expect(screen.getByLabelText(MANAGE_COPY.physicalQuantity)).toHaveValue('5')
  })

  it.each(['-1', '1.5', '2147483648'])(
    'не отправляет некорректный остаток %s',
    async (quantity) => {
      const write = vi.fn()
      http.defaults.adapter = async (config) => {
        if (config.method === 'patch') write()
        return response(config, product)
      }
      setup()
      const user = userEvent.setup()
      await user.clear(await screen.findByLabelText(MANAGE_COPY.physicalQuantity))
      await user.type(screen.getByLabelText(MANAGE_COPY.physicalQuantity), quantity)
      await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
      expect(await screen.findByText(MANAGE_COPY.quantityInvalid)).toBeVisible()
      expect(write).not.toHaveBeenCalled()
    },
  )

  it('показывает серверный конфликт резерва и вложенную ошибку характеристики у полей', async () => {
    http.defaults.adapter = async (config) => {
      if (config.method === 'patch')
        throw new AxiosError('bad', 'ERR_BAD_REQUEST', config, undefined, {
          ...response(config, {
            errors: {
              stock_quantity: ['Below reserved'],
              'attributes.intensity': ['Invalid integer'],
            },
          }),
          status: 400,
        })
      return response(config, product)
    }
    setup()
    await screen.findByLabelText(COPY.name)
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: MANAGE_COPY.save }))
    expect(await screen.findByText(MANAGE_COPY.quantityConflict)).toBeVisible()
    expect(screen.getByLabelText(COPY.intensity)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.queryByText('Below reserved')).not.toBeInTheDocument()
    expect(screen.getByLabelText(COPY.name)).toHaveValue(product.name)
  })

  it('требует явное согласие для изменений демо и сохраняет как свой только после него', async () => {
    const writes: unknown[] = []
    let current = { ...product, origin: 'demo' as 'demo' | 'owner' }
    http.defaults.adapter = async (config) => {
      if (config.method === 'patch') {
        writes.push(JSON.parse(config.data))
        current = { ...current, origin: 'owner' }
      }
      return response(config, current)
    }
    setup()
    await screen.findByLabelText(COPY.name)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
    expect(writes).toEqual([])
    expect(await screen.findByText(MANAGE_COPY.demoConsentRequired)).toBeVisible()
    await user.click(screen.getByLabelText(MANAGE_COPY.demoConsent))
    await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
    expect(await screen.findByText(MANAGE_COPY.saved)).toBeVisible()
    expect(writes[0]).toHaveProperty('save_as_owner', true)
    expect(screen.queryByLabelText(MANAGE_COPY.demoConsent)).not.toBeInTheDocument()
  })

  it('сбрасывает черновик и блокирует отложенный запрос после смены staff', async () => {
    let release: (() => void) | undefined
    const write = vi.fn()
    const gate = http.interceptors.request.use(async (config) => {
      if (config.method === 'patch')
        await new Promise<void>((resolve) => {
          release = resolve
        })
      return config
    })
    http.defaults.adapter = async (config) => {
      if (config.method === 'patch') write()
      return response(config, product)
    }
    try {
      const { client } = setup()
      const user = userEvent.setup()
      await user.clear(await screen.findByLabelText(COPY.name))
      await user.type(screen.getByLabelText(COPY.name), 'Черновик прошлого сотрудника')
      await user.click(screen.getByRole('button', { name: MANAGE_COPY.save }))
      await waitFor(() => expect(release).toBeDefined())
      act(() => staff('staff-b'))
      expect(await screen.findByLabelText(COPY.name)).toHaveValue(product.name)
      const invalidate = vi.spyOn(client, 'invalidateQueries')
      await act(async () => {
        release?.()
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(write).not.toHaveBeenCalled()
      expect(invalidate).not.toHaveBeenCalled()
      expect(screen.queryByText(MANAGE_COPY.saved)).not.toBeInTheDocument()
    } finally {
      http.interceptors.request.eject(gate)
    }
  })
})

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
import {
  MANAGE_COPY,
  PRODUCT_FORM_COPY,
  PRODUCT_GALLERY_COPY as COPY,
} from '@shared/lib/copy'
import { ToastProvider } from '@shared/ui/Toast'
import type { ManageProduct } from '../../api/manageCatalogApi'
import { PRODUCT_IMAGE_MAX_BYTES } from '../../lib/productImages'

const originalAdapter = http.defaults.adapter
const initial: ManageProduct = {
  id: 'product-a',
  slug: 'coffee-a',
  name: 'Кофе А',
  category: 'coffee',
  short_description: 'Мягкий вкус',
  description: 'Описание',
  price: '450.00',
  old_price: null,
  in_stock: true,
  available_quantity: 3,
  stock_quantity: 3,
  reserved_quantity: 0,
  origin: 'owner',
  is_published: true,
  hidden_reason: null,
  image_url: '/a.png',
  images: [
    { id: 1, url: '/a.png', order: 0, is_main: true },
    { id: 2, url: '/b.png', order: 1, is_main: false },
  ],
  attributes: { country: 'Италия' },
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
function reject(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  throw new AxiosError('synthetic failure', 'ERR_BAD_RESPONSE', config, undefined, {
    ...response(config, data),
    status,
  })
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
const photo = (position: number) =>
  screen.getByRole('listitem', { name: COPY.photo(position) })
const file = () => new File(['synthetic-image'], 'coffee.png', { type: 'image/png' })
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

describe('Фотографии в форме товара', () => {
  it('показывает подсказки для нового и демо-товара без обхода согласия', async () => {
    http.defaults.adapter = async (config) =>
      response(config, { ...initial, origin: 'demo' })
    const view = setup('/manage/products/new')
    expect(screen.getByText(COPY.createHint)).toBeVisible()
    expect(screen.queryByLabelText(COPY.upload)).not.toBeInTheDocument()
    view.unmount()
    setup()
    expect(await screen.findByText(COPY.demoHint)).toBeVisible()
    expect(screen.queryByLabelText(COPY.upload)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: COPY.mainLabel(2) })).toBeDisabled()
    expect(screen.getByLabelText(MANAGE_COPY.demoConsent)).not.toBeChecked()
  })

  it('загружает multipart и меняет порядок, главное и удаление, сохраняя несохранённые поля', async () => {
    const current = structuredClone(initial)
    const writes: {
      method: string | undefined
      path: string | undefined
      body: unknown
    }[] = []
    http.defaults.adapter = async (config) => {
      if (config.method !== 'get') {
        writes.push({ method: config.method, path: config.url, body: config.data })
        if (config.method === 'post') {
          expect(config.data).toBeInstanceOf(FormData)
          expect([...config.data.keys()]).toEqual(['image'])
          expect(config.data.get('image').name).toBe('coffee.png')
          current.images.push({ id: 3, url: '/c.png', order: 2, is_main: false })
        } else if (config.method === 'patch') {
          const values = JSON.parse(config.data)
          const id = Number(config.url?.split('/').at(-2))
          if (values.is_main)
            current.images = current.images.map((image) => ({
              ...image,
              is_main: image.id === id,
            }))
          if (values.order !== undefined) {
            const image = current.images.find((image) => image.id === id)!
            current.images = current.images.filter((image) => image.id !== id)
            current.images.splice(values.order, 0, image)
            current.images = current.images.map((image, order) => ({ ...image, order }))
          }
        } else if (config.method === 'delete') {
          const id = Number(config.url?.split('/').at(-2))
          current.images = current.images
            .filter((image) => image.id !== id)
            .map((image, order) => ({ ...image, order, is_main: order === 0 }))
        }
      }
      return response(config, structuredClone(current))
    }
    const { client } = setup()
    const user = userEvent.setup()
    await user.clear(await screen.findByLabelText(PRODUCT_FORM_COPY.name))
    await user.type(
      screen.getByLabelText(PRODUCT_FORM_COPY.name),
      'Несохранённое название',
    )
    expect(screen.getByRole('button', { name: COPY.earlierLabel(1) })).toBeDisabled()
    expect(screen.getByRole('button', { name: COPY.laterLabel(2) })).toBeDisabled()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await user.upload(screen.getByLabelText(COPY.upload), file())
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3))
    expect(screen.getByLabelText(PRODUCT_FORM_COPY.name)).toHaveValue(
      'Несохранённое название',
    )
    await user.click(within(photo(3)).getByRole('button', { name: COPY.mainLabel(3) }))
    await waitFor(() => expect(within(photo(3)).getByText(COPY.main)).toBeVisible())
    await user.click(
      within(photo(3)).getByRole('button', { name: COPY.earlierLabel(3) }),
    )
    await waitFor(() =>
      expect(within(photo(2)).getByRole('img')).toHaveAttribute('src', '/c.png'),
    )
    expect(screen.getByLabelText(PRODUCT_FORM_COPY.name)).toHaveValue(
      'Несохранённое название',
    )
    await user.click(
      within(photo(2)).getByRole('button', { name: COPY.removeLabel(2) }),
    )
    expect(writes.filter((write) => write.method === 'delete')).toHaveLength(0)
    await user.click(within(photo(2)).getByRole('button', { name: COPY.cancel }))
    expect(within(photo(2)).queryByText(COPY.removeQuestion)).not.toBeInTheDocument()
    await user.click(
      within(photo(2)).getByRole('button', { name: COPY.removeLabel(2) }),
    )
    await user.click(within(photo(2)).getByRole('button', { name: COPY.confirmRemove }))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
    expect(screen.getByLabelText(PRODUCT_FORM_COPY.name)).toHaveValue(
      'Несохранённое название',
    )
    expect(writes.map((write) => [write.method, write.path])).toEqual([
      ['post', '/api/manage/products/product-a/images/'],
      ['patch', '/api/manage/products/product-a/images/3/'],
      ['patch', '/api/manage/products/product-a/images/3/'],
      ['delete', '/api/manage/products/product-a/images/3/'],
    ])
    expect(JSON.parse(writes[1].body as string)).toEqual({ is_main: true })
    expect(JSON.parse(writes[2].body as string)).toEqual({ order: 1 })
    for (const name of ['products', 'cart', 'favorites'])
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [name] })
  })

  it('при ошибке GET после загрузки сохраняет поля и блокирует фото до успешного повтора', async () => {
    let current = structuredClone(initial)
    let failRead = false
    http.defaults.adapter = async (config) => {
      if (config.method === 'post') {
        current = {
          ...current,
          images: [
            ...current.images,
            { id: 3, url: '/c.png', order: 2, is_main: false },
          ],
        }
        failRead = true
      } else if (failRead) reject(config, 503, { detail: 'private-provider-text' })
      return response(config, current)
    }
    setup()
    const user = userEvent.setup()
    await user.clear(await screen.findByLabelText(PRODUCT_FORM_COPY.description))
    await user.type(
      screen.getByLabelText(PRODUCT_FORM_COPY.description),
      'Мой черновик',
    )
    await user.upload(screen.getByLabelText(COPY.upload), file())
    expect(await screen.findByText(COPY.refreshError)).toBeVisible()
    expect(screen.getByLabelText(PRODUCT_FORM_COPY.description)).toHaveValue(
      'Мой черновик',
    )
    expect(screen.getByLabelText(COPY.upload)).toBeDisabled()
    expect(screen.queryByText('private-provider-text')).not.toBeInTheDocument()
    failRead = false
    await user.click(screen.getByRole('button', { name: PRODUCT_FORM_COPY.retry }))
    await waitFor(() =>
      expect(screen.queryByText(COPY.refreshError)).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText(PRODUCT_FORM_COPY.description)).toHaveValue(
      'Мой черновик',
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByLabelText(COPY.upload)).toBeEnabled()
  })

  it('валидирует тип и размер до отправки и не повторяет upload без выбора файла', async () => {
    const write = vi.fn()
    http.defaults.adapter = async (config) => {
      if (config.method !== 'get') write()
      return response(config, initial)
    }
    setup()
    const user = userEvent.setup({ applyAccept: false })
    const input = await screen.findByLabelText(COPY.upload)
    await user.upload(input, new File(['svg'], 'photo.svg', { type: 'image/svg+xml' }))
    expect(await screen.findByText(COPY.invalidType)).toBeVisible()
    await user.upload(
      input,
      new File([new Uint8Array(PRODUCT_IMAGE_MAX_BYTES + 1)], 'large.png', {
        type: 'image/png',
      }),
    )
    expect(await screen.findByText(COPY.tooLarge)).toBeVisible()
    expect(input).toHaveValue('')
    expect(write).not.toHaveBeenCalled()
  })

  it('переводит отказ storage и устаревшую позицию без вывода внутренних сообщений', async () => {
    http.defaults.adapter = async (config) => {
      if (config.method === 'post')
        reject(config, 503, {
          code: 'image_storage_unavailable',
          detail: 'private-provider-token',
        })
      if (config.method === 'patch')
        reject(config, 400, { errors: { order: ['private-position'] } })
      return response(config, initial)
    }
    setup()
    const user = userEvent.setup()
    await user.upload(await screen.findByLabelText(COPY.upload), file())
    expect(await screen.findByText(COPY.storageError)).toBeVisible()
    expect(screen.queryByText('private-provider-token')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: COPY.earlierLabel(2) }))
    expect(await screen.findByText(COPY.stale)).toBeVisible()
    await user.click(screen.getByRole('button', { name: COPY.refresh }))
    await waitFor(() => expect(screen.queryByText(COPY.stale)).not.toBeInTheDocument())
  })

  it('показывает сохранённое демо-фото своего товара в общем порядке без обещания показа на витрине', async () => {
    http.defaults.adapter = async (config) =>
      response(config, {
        ...initial,
        images: [{ ...initial.images[0], is_mock: true }, initial.images[1]],
      })
    setup()
    expect(await screen.findByText(COPY.mockHidden)).toBeVisible()
    expect(within(photo(1)).getByText(COPY.mock)).toBeVisible()
    expect(within(photo(1)).queryByText(COPY.main)).not.toBeInTheDocument()
    expect(
      within(photo(1)).queryByRole('button', { name: COPY.mainLabel(1) }),
    ).not.toBeInTheDocument()
    expect(
      within(photo(1)).getByRole('button', { name: COPY.laterLabel(1) }),
    ).toBeEnabled()
    expect(
      within(photo(2)).getByRole('button', { name: COPY.mainLabel(2) }),
    ).toBeEnabled()
  })

  it('не отправляет отложенный upload после смены staff и не меняет новый draft', async () => {
    let release: (() => void) | undefined
    const write = vi.fn()
    const gate = http.interceptors.request.use(async (config) => {
      if (config.method === 'post')
        await new Promise<void>((resolve) => {
          release = resolve
        })
      return config
    })
    http.defaults.adapter = async (config) => {
      if (config.method === 'post') write()
      return response(config, initial)
    }
    try {
      const { client } = setup()
      const user = userEvent.setup()
      await user.upload(await screen.findByLabelText(COPY.upload), file())
      await waitFor(() => expect(release).toBeDefined())
      act(() => staff('staff-b'))
      await user.type(
        await screen.findByLabelText(PRODUCT_FORM_COPY.name),
        'Новый черновик',
      )
      const invalidate = vi.spyOn(client, 'invalidateQueries')
      await act(async () => {
        release?.()
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(write).not.toHaveBeenCalled()
      expect(invalidate).not.toHaveBeenCalled()
      expect(screen.queryByText(COPY.saved)).not.toBeInTheDocument()
      expect(screen.getByLabelText(PRODUCT_FORM_COPY.name)).toHaveValue(
        `${initial.name}Новый черновик`,
      )
    } finally {
      http.interceptors.request.eject(gate)
    }
  })

  it('не показывает результат старой загрузки после ухода из формы', async () => {
    let release: (() => void) | undefined
    http.defaults.adapter = async (config) => {
      if (config.method === 'post')
        await new Promise<void>((resolve) => {
          release = resolve
        })
      return response(config, initial)
    }
    setup()
    const user = userEvent.setup()
    await user.upload(await screen.findByLabelText(COPY.upload), file())
    await waitFor(() => expect(release).toBeDefined())
    await user.click(screen.getByRole('link', { name: MANAGE_COPY.backToProducts }))
    await act(async () => {
      release?.()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(screen.getByText('Список')).toBeVisible()
    expect(screen.queryByText(COPY.saved)).not.toBeInTheDocument()
  })
})

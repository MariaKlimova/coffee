import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { CatalogPage } from '@pages/CatalogPage'
import { CartPage } from '@pages/CartPage'
import { FavoritesPage } from '@pages/FavoritesPage'
import { useAuthStore } from '@entities/user'
import { productKeys } from '@entities/product'
import { ToastProvider } from '@shared/ui'
import { http } from '@shared/api'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'

import { ProductPage } from './ProductPage'

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
  name: 'Эфиопия Иргачеффе',
  slug: 'ethiopia-yirgacheffe',
  short_description: 'Цветочный аромат',
  price: '1290.00',
  old_price: null,
  category: 'coffee' as const,
  in_stock: true,
  image_url: 'https://example.com/coffee.jpg',
  is_favorite: false,
}

const detail = {
  ...listItem,
  description: 'Полное описание кофе',
  attributes: {
    country: 'Эфиопия',
    intensity: 8,
    bitterness: 2,
    acidity: 4,
    roast: 2,
    density: 3,
  },
  images: [{ url: 'https://example.com/coffee.jpg', order: 0, is_main: true }],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const machineItem = {
  ...listItem,
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Кофемашина Delonghi',
  slug: 'delonghi-magnifica',
  category: 'machines' as const,
}

const machineDetail = {
  ...machineItem,
  description: 'Полное описание кофемашины',
  attributes: {
    dimensions: '20 × 30 × 40 см',
    pressure_bar: 15,
    power_w: 1450,
    capsule_format: 'Нет',
    manufacturer_country: 'Италия',
  },
  images: [{ url: 'https://example.com/machine.jpg', order: 0, is_main: true }],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const relatedItem = {
  ...listItem,
  id: '33333333-3333-3333-3333-333333333333',
  slug: 'brazil',
  name: 'Бразилия',
  price: '990.00',
}
const relatedDetail = { ...detail, ...relatedItem, description: 'Описание Бразилии' }

function renderStore(path: string) {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/coffee" element={<CatalogPage category="coffee" />} />
        <Route path="/machines" element={<CatalogPage category="machines" />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
      </Routes>
    </ToastProvider>,
    { initialEntries: [path] },
  )
}

describe('ProductPage navigation and actions', () => {
  const adapter = vi.fn()
  let favorite = false
  let quantity = 0
  let delayList: boolean
  let resolveList: (() => void) | undefined
  let detailFailure: number | undefined

  beforeEach(() => {
    adapter.mockReset()
    favorite = false
    quantity = 0
    delayList = false
    resolveList = undefined
    detailFailure = undefined
    http.defaults.adapter = adapter
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0)
    useAuthStore.setState({
      status: 'guest',
      user: null,
      accessToken: null,
      refreshToken: null,
    })
    sessionStorage.clear()
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      const url = config.url ?? ''
      const body = config.data
        ? (JSON.parse(config.data as string) as Record<string, number>)
        : {}
      if (url === '/api/favorites/' && config.method === 'post') {
        favorite = true
        return jsonResponse(config, 201, {
          product_id: listItem.id,
          created_at: '2026-01-01',
        })
      }
      if (url === '/api/favorites/')
        return jsonResponse(config, 200, {
          count: 1,
          results: [{ ...listItem, is_favorite: true }],
        })
      if (url === '/api/cart/items/' && config.method === 'post')
        quantity += body.quantity
      if (url === '/api/cart/items/cart-line/' && config.method === 'patch')
        quantity = body.quantity
      const line = {
        id: 'cart-line',
        product: listItem,
        quantity,
        line_total: String(1290 * quantity),
      }
      if (url.startsWith('/api/cart/items/')) return jsonResponse(config, 200, line)
      if (url === '/api/cart/')
        return jsonResponse(config, 200, {
          items: quantity ? [line] : [],
          items_count: quantity,
          total: String(1290 * quantity),
        })
      if (url.endsWith('/related/'))
        return jsonResponse(config, 200, url.includes('ethiopia') ? [relatedItem] : [])
      if (url === '/api/products/') {
        if (delayList)
          await new Promise<void>((resolve) => {
            resolveList = resolve
          })
        return jsonResponse(config, 200, {
          count: 1,
          results: [listItem],
          next: null,
          previous: null,
        })
      }
      if (detailFailure) {
        throw new AxiosError(
          'Failure',
          AxiosError.ERR_BAD_RESPONSE,
          config,
          null,
          jsonResponse(config, detailFailure, {
            code: detailFailure === 404 ? 'not_found' : 'server_error',
          }),
        )
      }
      if (url.includes('delonghi'))
        return jsonResponse(config, 200, {
          ...machineDetail,
          in_stock: false,
          old_price: '1500.00',
        })
      if (url.includes('/brazil/')) return jsonResponse(config, 200, relatedDetail)
      return jsonResponse(config, 200, { ...detail, is_favorite: favorite })
    })
  })

  afterEach(() => {
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('renders the direct coffee page and title without scanning catalog pages', async () => {
    const { router } = renderStore('/product/ethiopia-yirgacheffe')
    const heading = await screen.findByRole('heading', {
      name: listItem.name,
      level: 1,
    })
    expect(heading).toHaveFocus()
    expect(document.title).toBe(`${listItem.name} — Coffee Shop`)
    expect(screen.getByText('Полное описание кофе')).toBeInTheDocument()
    expect(screen.getByText('Страна: Эфиопия')).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: listItem.name })[0]).toHaveAttribute(
      'src',
      'https://example.com/coffee.jpg',
    )
    expect(screen.getByRole('link', { name: 'Вернуться в каталог' })).toHaveAttribute(
      'href',
      '/coffee',
    )
    expect(screen.queryByRole('button', { name: 'Закрыть' })).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/product/ethiopia-yirgacheffe')
    expect(adapter.mock.calls.some(([config]) => config.url === '/api/products/')).toBe(
      false,
    )
  })

  it('renders machine characteristics, old price and unavailable state with a category fallback', async () => {
    renderStore('/product/delonghi-magnifica')
    await screen.findByRole('heading', { name: machineItem.name, level: 1 })
    expect(screen.getByText('20 × 30 × 40 см')).toBeInTheDocument()
    expect(screen.getByText('15 бар')).toBeInTheDocument()
    expect(screen.getByText('1 500 ₽', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Нет в наличии')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Добавить в корзину' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Вернуться в каталог' })).toHaveAttribute(
      'href',
      '/machines',
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Похожие товары' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('keeps all catalog query fields and scroll through related, browser Back and delayed list reload', async () => {
    const user = userEvent.setup()
    const origin =
      '/coffee?search=bean&price_min=100&price_max=5000&ordering=price&in_stock=true&page=2'
    const { router, queryClient } = renderStore(origin)
    const links = await screen.findAllByRole('link', { name: listItem.name })
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(840)
    await user.click(links[0])
    await screen.findByRole('heading', { name: listItem.name, level: 1 })
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
    const strip = await screen.findByRole('region', { name: 'Лента похожих товаров' })
    await user.click(within(strip).getAllByRole('link', { name: 'Бразилия' })[0])
    await screen.findByRole('heading', { name: 'Бразилия', level: 1 })
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(
      origin,
    )
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
    await act(() => router.navigate(-1))
    await screen.findByRole('heading', { name: listItem.name, level: 1 })
    queryClient.removeQueries({
      queryKey: productKeys.all,
      predicate: (query) => query.queryKey[1] === 'list',
    })
    delayList = true
    vi.mocked(window.scrollTo).mockClear()
    await act(() => router.navigate(-1))
    await screen.findByLabelText('Загрузка каталога')
    expect(window.scrollTo).not.toHaveBeenCalled()
    await waitFor(() => expect(resolveList).toBeDefined())
    await act(async () => resolveList?.())
    await screen.findByRole('heading', { name: listItem.name, level: 3 })
    expect(router.state.location.pathname + router.state.location.search).toBe(origin)
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 840, behavior: 'instant' })
    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/products/',
        params: expect.objectContaining({
          search: 'bean',
          price_min: '100',
          price_max: '5000',
          ordering: 'price',
          in_stock: 'true',
          page: '2',
        }),
      }),
    )
    await act(() => router.navigate(1))
    await screen.findByRole('heading', { name: listItem.name, level: 1 })
    await act(() => router.navigate(1))
    await screen.findByRole('heading', { name: 'Бразилия', level: 1 })
  })

  it('returns explicitly from a related product to the original catalog and scroll', async () => {
    const user = userEvent.setup()
    const { router } = renderStore('/coffee?ordering=-price&page=3')
    const links = await screen.findAllByRole('link', { name: listItem.name })
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(600)
    await user.click(links[0])
    const strip = await screen.findByRole('region', { name: 'Лента похожих товаров' })
    await user.click(within(strip).getAllByRole('link', { name: 'Бразилия' })[0])
    await screen.findByRole('heading', { name: 'Бразилия', level: 1 })
    await user.click(screen.getByRole('link', { name: 'Вернуться в каталог' }))
    await screen.findByRole('heading', { name: listItem.name, level: 3 })
    expect(router.state.location.pathname + router.state.location.search).toBe(
      '/coffee?ordering=-price&page=3',
    )
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 600, behavior: 'instant' })
  })

  it('waits for a cached catalog background refresh before restoring scroll', async () => {
    const user = userEvent.setup()
    const { router } = renderStore('/coffee?ordering=price')
    const links = await screen.findAllByRole('link', { name: listItem.name })
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(840)
    await user.click(links[0])
    await screen.findByRole('heading', { name: listItem.name, level: 1 })
    delayList = true
    vi.mocked(window.scrollTo).mockClear()
    await act(() => router.navigate(-1))
    await screen.findByRole('heading', { name: listItem.name, level: 3 })
    await waitFor(() => expect(resolveList).toBeDefined())
    expect(window.scrollTo).not.toHaveBeenCalled()
    await act(async () => resolveList?.())
    await waitFor(() =>
      expect(window.scrollTo).toHaveBeenLastCalledWith({
        top: 840,
        behavior: 'instant',
      }),
    )
  })

  it('keeps cart and favorite controls on the detail page, updating the existing cart line', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'test@example.com', first_name: '', last_name: '' },
    })
    const user = userEvent.setup()
    const { router } = renderStore('/product/ethiopia-yirgacheffe')
    await screen.findByRole('heading', { name: listItem.name, level: 1 })
    await user.click(screen.getAllByRole('button', { name: 'Увеличить количество' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Добавить в корзину' })[0])
    await waitFor(() => expect(quantity).toBe(2))
    await screen.findByText('Добавлено в корзину')
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Добавить в корзину' }),
      ).not.toBeInTheDocument(),
    )
    await user.click(screen.getAllByRole('button', { name: 'Увеличить количество' })[0])
    await waitFor(() => expect(quantity).toBe(3))
    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'patch',
        url: '/api/cart/items/cart-line/',
        data: JSON.stringify({ quantity: 3 }),
      }),
    )
    await user.click(screen.getAllByRole('button', { name: 'В избранное' })[0])
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Убрать из избранного' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    )
    expect(router.state.location.pathname).toBe('/product/ethiopia-yirgacheffe')
  })

  it.each(['/cart', '/favorites'])(
    'opens the actual product page from %s',
    async (path) => {
      quantity = 1
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'access',
        user: { id: 'u1', email: 'test@example.com', first_name: '', last_name: '' },
      })
      const user = userEvent.setup()
      const { router } = renderStore(path)
      const links = await screen.findAllByRole('link', { name: listItem.name })
      await user.click(links[0])
      await screen.findByRole('heading', { name: listItem.name, level: 1 })
      expect(router.state.location.pathname).toBe('/product/ethiopia-yirgacheffe')
    },
  )

  it('shows loading without redirecting while the detail request is pending', async () => {
    adapter.mockImplementation(() => new Promise<AxiosResponse>(() => undefined))
    const { router } = renderStore('/product/ethiopia-yirgacheffe')
    expect(screen.getByLabelText('Открываем товар')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/product/ethiopia-yirgacheffe')
  })

  it('keeps owner detail and related links without shopping controls or buyer requests', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'owner', email: 'owner@example.invalid', is_staff: true },
    })
    renderStore('/product/ethiopia-yirgacheffe')
    await screen.findByRole('heading', { name: listItem.name, level: 1 })
    await screen.findByRole('heading', { name: 'Похожие товары' })
    expect(
      screen.queryByRole('button', {
        name: /В корзину|Добавить в корзину|избранное|количество/,
      }),
    ).not.toBeInTheDocument()
    expect(
      adapter.mock.calls.every(([config]) => config.url?.startsWith('/api/products/')),
    ).toBe(true)
  })

  it('recovers from a detail request error using retry', async () => {
    detailFailure = 500
    const user = userEvent.setup()
    renderStore('/product/ethiopia-yirgacheffe')
    await screen.findByText('Не удалось открыть товар')
    detailFailure = undefined
    await user.click(screen.getByRole('button', { name: 'Попробовать ещё раз' }))
    await screen.findByRole('heading', { name: listItem.name, level: 1 })
  })

  it('shows 404 with a safe return and strips recursive legacy parameters', async () => {
    detailFailure = 404
    renderStore(
      '/product/gone?returnTo=' +
        encodeURIComponent(
          '/machines?page=2&product=gone&returnTo=https://evil.example',
        ),
    )
    await screen.findByText('Не нашли такой товар')
    expect(screen.getByRole('link', { name: 'Вернуться в каталог' })).toHaveAttribute(
      'href',
      '/machines?page=2',
    )
  })

  it.each([
    'https://evil.example',
    '//evil.example/coffee',
    '/cart',
    '/coffee/../cart',
    '/\\evil.example/coffee',
  ])('rejects unsafe returnTo %s', async (returnTo) => {
    renderStore('/product/delonghi-magnifica?returnTo=' + encodeURIComponent(returnTo))
    await screen.findByRole('heading', { name: machineItem.name, level: 1 })
    expect(screen.getByRole('link', { name: 'Вернуться в каталог' })).toHaveAttribute(
      'href',
      '/machines',
    )
  })
})

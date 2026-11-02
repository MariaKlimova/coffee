import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { http } from '@shared/api'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'
import { ToastProvider } from '@shared/ui'
import { useAuthStore } from '@entities/user'

import { CatalogPage } from './CatalogPage'

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

function renderCatalog(initialPath = '/coffee') {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/coffee" element={<CatalogPage category="coffee" />} />
        <Route path="/machines" element={<CatalogPage category="machines" />} />
        <Route path="/product/:slug" element={<h1>Страница товара</h1>} />
      </Routes>
    </ToastProvider>,
    { initialEntries: [initialPath] },
  )
}

describe('CatalogPage', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    useAuthStore.setState({
      status: 'guest',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
  })

  afterEach(() => {
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('shows owner products and links without buyer controls or buyer requests', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'owner', email: 'owner@example.invalid', is_staff: true },
    })
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        count: 1,
        results: [listItem],
        next: null,
        previous: null,
      }),
    )
    renderCatalog()
    expect(
      await screen.findByRole('heading', { name: listItem.name }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /В корзину|избранное/ }),
    ).not.toBeInTheDocument()
    expect(
      adapter.mock.calls.every(([config]) => config.url === '/api/products/'),
    ).toBe(true)
  })

  it('shows skeletons, then cards, and sends category in the list request', async () => {
    let resolveList!: (value: AxiosResponse) => void
    adapter.mockImplementation(
      (config: InternalAxiosRequestConfig) =>
        new Promise<AxiosResponse>((resolve) => {
          resolveList = resolve
          void config
        }),
    )

    renderCatalog()

    expect(screen.getByLabelText('Загрузка каталога')).toBeInTheDocument()

    await waitFor(() => {
      expect(adapter).toHaveBeenCalled()
    })

    resolveList(
      jsonResponse(adapter.mock.calls[0][0] as InternalAxiosRequestConfig, 200, {
        count: 1,
        next: null,
        previous: null,
        results: [listItem],
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Эфиопия Иргачеффе' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Кофе' })).toBeInTheDocument()

    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig
    expect(config.url).toContain('/api/products/')
    expect(config.params).toMatchObject({ category: 'coffee' })
  })

  it('shows empty state and clears filters on reset', async () => {
    const user = userEvent.setup()
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      const params = config.params as Record<string, string> | undefined
      if (params?.price_min === '99999') {
        return jsonResponse(config, 200, {
          count: 0,
          next: null,
          previous: null,
          results: [],
        })
      }
      return jsonResponse(config, 200, {
        count: 1,
        next: null,
        previous: null,
        results: [listItem],
      })
    })

    const { router } = renderCatalog('/coffee?price_min=99999')

    expect(await screen.findByText('Ничего не нашлось')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))

    expect(
      await screen.findByRole('heading', { name: 'Эфиопия Иргачеффе' }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.search).not.toContain('price_min')
    })
  })

  it('changes page through pagination controls', async () => {
    const user = userEvent.setup()
    const page1 = Array.from({ length: 20 }, (_, index) => ({
      ...listItem,
      id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
      slug: `coffee-${index}`,
      name: `Кофе ${index + 1}`,
    }))
    const page2Item = {
      ...listItem,
      id: '33333333-3333-3333-3333-333333333333',
      slug: 'coffee-page-2',
      name: 'Кофе со второй страницы',
    }

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      const params = config.params as Record<string, string> | undefined
      if (params?.page === '2') {
        return jsonResponse(config, 200, {
          count: 21,
          next: null,
          previous: 'http://example/api/products/?page=1',
          results: [page2Item],
        })
      }
      return jsonResponse(config, 200, {
        count: 21,
        next: 'http://example/api/products/?page=2',
        previous: null,
        results: page1,
      })
    })

    const { router } = renderCatalog()

    await screen.findByRole('heading', { name: 'Кофе 1' })
    const nav = screen.getByRole('navigation', { name: 'Страницы каталога' })
    await user.click(within(nav).getByRole('button', { name: '2' }))

    expect(
      await screen.findByRole('heading', { name: 'Кофе со второй страницы' }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.search).toContain('page=2')
    })
  })

  it('restores applied price and sorting with Back while retaining search', async () => {
    const user = userEvent.setup()
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        count: 1,
        results: [listItem],
        next: null,
        previous: null,
      }),
    )
    const { router } = renderCatalog('/coffee?search=flowers&page=2')
    await screen.findByRole('heading', { name: listItem.name })
    await user.type(screen.getByLabelText('Цена от'), '100')
    await user.tab()
    expect(router.state.historyAction).toBe('PUSH')
    expect(router.state.location.search).toBe('?search=flowers&price_min=100')
    await user.selectOptions(screen.getByLabelText('Сортировка'), 'price')
    expect(router.state.location.search).toContain('ordering=price')

    await act(async () => router.navigate(-1))
    expect(screen.getByLabelText('Сортировка')).toHaveValue('-created_at')
    expect(screen.getByLabelText('Цена от')).toHaveValue('100')
    expect(router.state.location.search).toBe('?search=flowers&price_min=100')

    await act(async () => router.navigate(-1))
    expect(screen.getByLabelText('Цена от')).toHaveValue('')
    expect(router.state.location.search).toBe('?search=flowers&page=2')
    await waitFor(() => {
      expect(adapter).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ search: 'flowers', page: '2' }),
        }),
      )
    })
  })

  it('toggles favorite in the grid optimistically for an authenticated user', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'a@b.c', first_name: 'A', last_name: 'B' },
    })

    let favorited = false
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/api/favorites/') && config.method === 'post') {
        favorited = true
        return jsonResponse(config, 201, {
          product_id: listItem.id,
          created_at: '2026-01-01T00:00:00Z',
        })
      }
      if (config.url?.includes('/api/favorites/')) {
        return jsonResponse(config, 200, {
          count: favorited ? 1 : 0,
          next: null,
          previous: null,
          results: [],
        })
      }
      return jsonResponse(config, 200, {
        count: 1,
        next: null,
        previous: null,
        results: [{ ...listItem, is_favorite: favorited }],
      })
    })

    renderCatalog()

    await screen.findByRole('heading', { name: 'Эфиопия Иргачеффе' })
    const favoriteButton = screen.getByRole('button', { name: 'В избранное' })
    expect(favoriteButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(favoriteButton)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Убрать из избранного' }),
      ).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('rolls favorite back in the grid when the API fails', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'a@b.c', first_name: 'A', last_name: 'B' },
    })

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/api/favorites/') && config.method === 'post') {
        throw new AxiosError(
          'Server Error',
          AxiosError.ERR_BAD_RESPONSE,
          config,
          null,
          jsonResponse(config, 500, { detail: 'boom', code: 'server_error' }),
        )
      }
      if (config.url?.includes('/api/favorites/')) {
        return jsonResponse(config, 200, {
          count: 0,
          next: null,
          previous: null,
          results: [],
        })
      }
      return jsonResponse(config, 200, {
        count: 1,
        next: null,
        previous: null,
        results: [listItem],
      })
    })

    renderCatalog()

    await screen.findByRole('heading', { name: 'Эфиопия Иргачеффе' })
    await user.click(screen.getByRole('button', { name: 'В избранное' }))

    expect(
      await screen.findByText('Не удалось обновить избранное. Попробуй ещё раз'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'В избранное' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
  it('opens a real product link without expanding or changing the catalog URL', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        count: 1,
        results: [listItem],
        next: null,
        previous: null,
      }),
    )
    const user = userEvent.setup()
    const { router } = renderCatalog('/coffee?search=цветы&price_min=100&page=2')
    const links = await screen.findAllByRole('link', { name: listItem.name })
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringContaining('/product/ethiopia-yirgacheffe?returnTo='),
    )
    await user.click(links[0])
    expect(
      await screen.findByRole('heading', { name: 'Страница товара' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/product/ethiopia-yirgacheffe')
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(
      '/coffee?search=%D1%86%D0%B2%D0%B5%D1%82%D1%8B&price_min=100&page=2',
    )
    expect(
      adapter.mock.calls.some(
        ([config]) => config.url === '/api/products/ethiopia-yirgacheffe/',
      ),
    ).toBe(false)
  })

  it.each(['/coffee', '/machines'])(
    'replaces a legacy %s?product link without requiring the product in the listing',
    async (category) => {
      adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
        jsonResponse(config, 200, {
          count: 0,
          results: [],
          next: null,
          previous: null,
        }),
      )
      const { router } = renderCatalog(
        `${category}?page=3&product=old-slug&search=bean`,
      )
      await screen.findByRole('heading', { name: 'Страница товара' })
      expect(router.state.location.pathname).toBe('/product/old-slug')
      expect(router.state.historyAction).toBe('REPLACE')
      const returnTo = new URLSearchParams(router.state.location.search).get('returnTo')
      expect(returnTo).toBe(`${category}?page=3&search=bean`)
    },
  )
})

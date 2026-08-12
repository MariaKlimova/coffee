import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { http } from '@shared/api'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'
import { ToastProvider } from '@shared/ui'

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

const secondItem = {
  ...listItem,
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Бразилия Сантос',
  slug: 'brazil-santos',
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

function renderCatalog(initialPath = '/coffee') {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/coffee" element={<CatalogPage category="coffee" />} />
        <Route path="/machines" element={<CatalogPage category="machines" />} />
      </Routes>
    </ToastProvider>,
    { initialEntries: [initialPath] },
  )
}

function isProductDetailUrl(url: string | undefined, slug: string): boolean {
  return Boolean(url?.includes(`/${slug}/`) && !url.includes('/related/'))
}

function isRelatedUrl(url: string | undefined, slug: string): boolean {
  return Boolean(url?.includes(`/${slug}/related/`))
}

describe('CatalogPage', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
  })

  afterEach(() => {
    delete http.defaults.adapter
    vi.restoreAllMocks()
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

  it('expands a card via detail fetch and writes ?product= into the URL', async () => {
    const user = userEvent.setup()
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (isRelatedUrl(config.url, 'ethiopia-yirgacheffe')) {
        return jsonResponse(config, 200, [])
      }
      if (isProductDetailUrl(config.url, 'ethiopia-yirgacheffe')) {
        return jsonResponse(config, 200, detail)
      }
      return jsonResponse(config, 200, {
        count: 1,
        next: null,
        previous: null,
        results: [listItem],
      })
    })

    const { router } = renderCatalog()

    await screen.findByRole('heading', { name: 'Эфиопия Иргачеффе' })
    await user.click(screen.getByRole('button', { name: 'Эфиопия Иргачеффе' }))

    expect(await screen.findByText('Полное описание кофе')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeInTheDocument()

    await waitFor(() => {
      expect(router.state.location.search).toContain('product=ethiopia-yirgacheffe')
    })
  })

  it('names the tab after the expanded product and restores it on close', async () => {
    const user = userEvent.setup()
    // index.html ships a static <title>; React 19 must layer over it, not replace it.
    const staticTitle = document.createElement('title')
    staticTitle.textContent = 'Coffee Shop'
    document.head.appendChild(staticTitle)
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (isRelatedUrl(config.url, 'ethiopia-yirgacheffe')) {
        return jsonResponse(config, 200, [])
      }
      if (isProductDetailUrl(config.url, 'ethiopia-yirgacheffe')) {
        return jsonResponse(config, 200, detail)
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
    await user.click(screen.getByRole('button', { name: 'Эфиопия Иргачеффе' }))

    await waitFor(() => {
      expect(document.title).toBe('Эфиопия Иргачеффе — Coffee Shop')
    })

    await user.click(screen.getByRole('button', { name: 'Закрыть' }))
    await waitFor(() => {
      expect(document.title).toBe('Coffee Shop')
    })

    staticTitle.remove()
  })

  it('collapses on close and expands only one card at a time', async () => {
    const user = userEvent.setup()
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (
        isRelatedUrl(config.url, 'ethiopia-yirgacheffe') ||
        isRelatedUrl(config.url, 'brazil-santos')
      ) {
        return jsonResponse(config, 200, [])
      }
      if (isProductDetailUrl(config.url, 'ethiopia-yirgacheffe')) {
        return jsonResponse(config, 200, detail)
      }
      if (isProductDetailUrl(config.url, 'brazil-santos')) {
        return jsonResponse(config, 200, {
          ...detail,
          ...secondItem,
          description: 'Описание Бразилии',
        })
      }
      return jsonResponse(config, 200, {
        count: 2,
        next: null,
        previous: null,
        results: [listItem, secondItem],
      })
    })

    renderCatalog()

    await screen.findByRole('heading', { name: 'Эфиопия Иргачеффе' })
    await user.click(screen.getByRole('button', { name: 'Эфиопия Иргачеффе' }))
    expect(await screen.findByText('Полное описание кофе')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Бразилия Сантос' }))
    expect(await screen.findByText('Описание Бразилии')).toBeInTheDocument()
    expect(screen.queryByText('Полное описание кофе')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Закрыть' }))
    await waitFor(() => {
      expect(screen.queryByText('Описание Бразилии')).not.toBeInTheDocument()
    })
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

  it('clears orphan ?product= that is not on the current page', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        count: 1,
        next: null,
        previous: null,
        results: [listItem],
      }),
    )

    const { router } = renderCatalog('/coffee?product=missing-slug')

    await screen.findByRole('heading', { name: 'Эфиопия Иргачеффе' })
    await waitFor(() => {
      expect(router.state.location.search).not.toContain('product=')
    })
  })

  it('shows a detail error with retry instead of a silent card fallback', async () => {
    const user = userEvent.setup()
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (isRelatedUrl(config.url, 'ethiopia-yirgacheffe')) {
        return jsonResponse(config, 200, [])
      }
      if (isProductDetailUrl(config.url, 'ethiopia-yirgacheffe')) {
        throw new AxiosError(
          'Server Error',
          AxiosError.ERR_BAD_RESPONSE,
          config,
          null,
          jsonResponse(config, 500, {
            detail: 'boom',
            code: 'server_error',
          }),
        )
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
    await user.click(screen.getByRole('button', { name: 'Эфиопия Иргачеффе' }))

    expect(await screen.findByText('Не удалось открыть товар')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Попробовать ещё раз' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeInTheDocument()
  })

  it('switches to a similar product that passes current filters', async () => {
    const user = userEvent.setup()
    const relatedOnPage = {
      ...secondItem,
      price: '990.00',
    }
    const relatedDetail = {
      ...detail,
      ...relatedOnPage,
      description: 'Описание Бразилии',
    }

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (isRelatedUrl(config.url, 'ethiopia-yirgacheffe')) {
        return jsonResponse(config, 200, [relatedOnPage])
      }
      if (isRelatedUrl(config.url, 'brazil-santos')) {
        return jsonResponse(config, 200, [])
      }
      if (isProductDetailUrl(config.url, 'ethiopia-yirgacheffe')) {
        return jsonResponse(config, 200, detail)
      }
      if (isProductDetailUrl(config.url, 'brazil-santos')) {
        return jsonResponse(config, 200, relatedDetail)
      }
      return jsonResponse(config, 200, {
        count: 2,
        next: null,
        previous: null,
        results: [listItem, relatedOnPage],
      })
    })

    const { router } = renderCatalog('/coffee?product=ethiopia-yirgacheffe')

    expect(await screen.findByText('Полное описание кофе')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Похожие товары' }),
    ).toBeInTheDocument()

    const similarStrip = screen.getByRole('region', { name: 'Лента похожих товаров' })
    await user.click(
      within(similarStrip).getByRole('button', { name: 'Бразилия Сантос' }),
    )

    await waitFor(() => {
      expect(router.state.location.search).toContain('product=brazil-santos')
    })
    expect(router.state.location.search).not.toContain('price_')
    expect(await screen.findByText('Описание Бразилии')).toBeInTheDocument()
  })

  it('resets filters and shows a toast when a similar product is filtered out', async () => {
    const user = userEvent.setup()
    const expensiveRelated = {
      ...secondItem,
      name: 'Дорогая Бразилия',
      slug: 'brazil-expensive',
      price: '24990.00',
    }
    const expensiveDetail = {
      ...detail,
      ...expensiveRelated,
      description: 'Описание дорогой Бразилии',
    }

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      const params = config.params as Record<string, string> | undefined

      if (isRelatedUrl(config.url, 'ethiopia-yirgacheffe')) {
        return jsonResponse(config, 200, [expensiveRelated])
      }
      if (isRelatedUrl(config.url, 'brazil-expensive')) {
        return jsonResponse(config, 200, [])
      }
      if (isProductDetailUrl(config.url, 'ethiopia-yirgacheffe')) {
        return jsonResponse(config, 200, detail)
      }
      if (isProductDetailUrl(config.url, 'brazil-expensive')) {
        return jsonResponse(config, 200, expensiveDetail)
      }

      if (params?.price_max === '10000') {
        return jsonResponse(config, 200, {
          count: 1,
          next: null,
          previous: null,
          results: [listItem],
        })
      }

      return jsonResponse(config, 200, {
        count: 2,
        next: null,
        previous: null,
        results: [listItem, expensiveRelated],
      })
    })

    const { router } = renderCatalog(
      '/coffee?price_max=10000&product=ethiopia-yirgacheffe',
    )

    expect(await screen.findByText('Полное описание кофе')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Похожие товары' }),
    ).toBeInTheDocument()

    const similarStrip = screen.getByRole('region', { name: 'Лента похожих товаров' })
    await user.click(
      within(similarStrip).getByRole('button', { name: 'Дорогая Бразилия' }),
    )

    await waitFor(() => {
      expect(router.state.location.search).toContain('product=brazil-expensive')
    })
    expect(router.state.location.search).not.toContain('price_max')
    expect(
      await screen.findByText('Сбросили фильтры, чтобы показать товар'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Описание дорогой Бразилии')).toBeInTheDocument()
  })
})

import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { useAuthStore } from '@entities/user'
import { http } from '@shared/api'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'
import { ToastProvider } from '@shared/ui'

import { FavoritesPage } from './FavoritesPage'
import { FAVORITES_PAGE_COPY } from './FavoritesPage.const'

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
  is_favorite: true,
}

const secondItem = {
  ...listItem,
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Бразилия Сантос',
  slug: 'brazil-santos',
}

function renderFavorites(initialPath = '/favorites') {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/coffee" element={<div>Каталог кофе</div>} />
      </Routes>
    </ToastProvider>,
    { initialEntries: [initialPath] },
  )
}

describe('FavoritesPage', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: {
        id: 'u1',
        email: 'a@b.c',
        first_name: 'A',
        last_name: 'B',
      },
    })
  })

  afterEach(() => {
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('shows skeletons, then favorite cards', async () => {
    let resolveList!: (value: AxiosResponse) => void
    adapter.mockImplementation(
      (config: InternalAxiosRequestConfig) =>
        new Promise<AxiosResponse>((resolve) => {
          resolveList = resolve
          void config
        }),
    )

    renderFavorites()

    expect(screen.getByLabelText(FAVORITES_PAGE_COPY.loadingLabel)).toBeInTheDocument()

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
      await screen.findByRole('heading', { name: listItem.name }),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(FAVORITES_PAGE_COPY.loadingLabel),
    ).not.toBeInTheDocument()

    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig
    expect(config.url).toContain('/api/favorites/')
  })

  it('shows an empty state with a link to the coffee catalog', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        count: 0,
        next: null,
        previous: null,
        results: [],
      }),
    )

    renderFavorites()

    expect(
      await screen.findByRole('heading', { name: FAVORITES_PAGE_COPY.emptyTitle }),
    ).toBeInTheDocument()
    expect(screen.getByText(FAVORITES_PAGE_COPY.emptyDescription)).toBeInTheDocument()

    const catalogLink = screen.getByRole('link', {
      name: FAVORITES_PAGE_COPY.goToCatalog,
    })
    expect(catalogLink).toHaveAttribute('href', '/coffee')
  })

  it('removes a card from the grid optimistically when unfavoriting', async () => {
    const user = userEvent.setup()
    let favorited = true

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/api/favorites/') && config.method === 'delete') {
        favorited = false
        return jsonResponse(config, 204, undefined)
      }
      if (config.url?.includes('/api/favorites/') && config.method === 'get') {
        return jsonResponse(config, 200, {
          count: favorited ? 1 : 0,
          next: null,
          previous: null,
          results: favorited ? [listItem] : [],
        })
      }
      return jsonResponse(config, 200, {
        count: favorited ? 1 : 0,
        next: null,
        previous: null,
        results: favorited ? [listItem] : [],
      })
    })

    renderFavorites()

    await screen.findByRole('heading', { name: listItem.name })
    await user.click(screen.getByRole('button', { name: 'Убрать из избранного' }))

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: listItem.name }),
      ).not.toBeInTheDocument()
    })
    expect(
      await screen.findByRole('heading', { name: FAVORITES_PAGE_COPY.emptyTitle }),
    ).toBeInTheDocument()
  })

  it('goes to the previous page when the last card on a later page is unfavorited', async () => {
    const user = userEvent.setup()
    let pageTwoItemFavorited = true

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/api/favorites/') && config.method === 'delete') {
        pageTwoItemFavorited = false
        return jsonResponse(config, 204, undefined)
      }

      const requestPage = Number(config.params?.page ?? 1)
      if (requestPage >= 2) {
        return jsonResponse(config, 200, {
          count: pageTwoItemFavorited ? 21 : 20,
          next: null,
          previous: 'http://example/api/favorites/?page=1',
          results: pageTwoItemFavorited ? [secondItem] : [],
        })
      }

      return jsonResponse(config, 200, {
        count: pageTwoItemFavorited ? 21 : 20,
        next: pageTwoItemFavorited ? 'http://example/api/favorites/?page=2' : null,
        previous: null,
        results: [listItem],
      })
    })

    const { router } = renderFavorites('/favorites?page=2')

    await screen.findByRole('heading', { name: secondItem.name })
    await user.click(screen.getByRole('button', { name: 'Убрать из избранного' }))

    await waitFor(() => {
      expect(router.state.location.search).not.toContain('page=2')
    })
    expect(
      await screen.findByRole('heading', { name: listItem.name }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: FAVORITES_PAGE_COPY.emptyTitle }),
    ).not.toBeInTheDocument()
  })

  it('shows an error state with retry', async () => {
    const user = userEvent.setup()
    let shouldFail = true

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (shouldFail) {
        throw new AxiosError(
          'Server Error',
          AxiosError.ERR_BAD_RESPONSE,
          config,
          null,
          jsonResponse(config, 500, { detail: 'boom', code: 'server_error' }),
        )
      }
      return jsonResponse(config, 200, {
        count: 1,
        next: null,
        previous: null,
        results: [listItem],
      })
    })

    renderFavorites()

    expect(
      await screen.findByRole('heading', { name: FAVORITES_PAGE_COPY.errorTitle }),
    ).toBeInTheDocument()

    shouldFail = false
    await user.click(screen.getByRole('button', { name: FAVORITES_PAGE_COPY.retry }))

    expect(
      await screen.findByRole('heading', { name: listItem.name }),
    ).toBeInTheDocument()
  })

  it('changes the page query and requests the next page', async () => {
    const user = userEvent.setup()

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      const page = Number(config.params?.page ?? 1)
      if (page >= 2) {
        return jsonResponse(config, 200, {
          count: 21,
          next: null,
          previous: 'http://example/api/favorites/?page=1',
          results: [secondItem],
        })
      }
      return jsonResponse(config, 200, {
        count: 21,
        next: 'http://example/api/favorites/?page=2',
        previous: null,
        results: [listItem],
      })
    })

    const { router } = renderFavorites()

    await screen.findByRole('heading', { name: listItem.name })
    await user.click(screen.getByRole('button', { name: 'Вперёд' }))

    await waitFor(() => {
      expect(router.state.location.search).toContain('page=2')
    })
    expect(
      await screen.findByRole('heading', { name: secondItem.name }),
    ).toBeInTheDocument()

    const lastConfig = adapter.mock.calls.at(-1)?.[0] as InternalAxiosRequestConfig
    expect(lastConfig.params).toMatchObject({ page: '2' })
  })
})

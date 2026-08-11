import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

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

function listPage(results: unknown[], next: string | null) {
  return { count: 42, next, previous: null, results }
}

function renderProductPage(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/product/:slug" element={<ProductPage />} />
      <Route path="/coffee" element={<h1>Кофе</h1>} />
      <Route path="/machines" element={<h1>Кофемашины</h1>} />
    </Routes>,
    { initialEntries: [path] },
  )
}

describe('ProductPage', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
  })

  afterEach(() => {
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('shows a skeleton while the product is being resolved', async () => {
    adapter.mockImplementation(() => new Promise<AxiosResponse>(() => undefined))

    renderProductPage('/product/ethiopia-yirgacheffe')

    expect(screen.getByLabelText('Открываем товар')).toBeInTheDocument()
    await waitFor(() => {
      expect(adapter).toHaveBeenCalled()
    })
  })

  it('redirects to the category route with ?product= for a first-page product', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/ethiopia-yirgacheffe/')) {
        return jsonResponse(config, 200, detail)
      }
      return jsonResponse(config, 200, listPage([listItem], null))
    })

    const { router } = renderProductPage('/product/ethiopia-yirgacheffe')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/coffee')
    })
    expect(router.state.location.search).toBe('?product=ethiopia-yirgacheffe')
  })

  it('redirects to the page where the product actually sits', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/delonghi-magnifica/')) {
        return jsonResponse(config, 200, machineDetail)
      }
      const params = config.params as Record<string, string> | undefined
      if (params?.page === '2') {
        return jsonResponse(config, 200, listPage([machineItem], null))
      }
      return jsonResponse(
        config,
        200,
        listPage([{ ...machineItem, slug: 'other-machine' }], 'http://example/?page=2'),
      )
    })

    const { router } = renderProductPage('/product/delonghi-magnifica')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/machines')
    })
    expect(router.state.location.search).toContain('page=2')
    expect(router.state.location.search).toContain('product=delonghi-magnifica')
  })

  it('drops ?product= when the slug is missing from the listing', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/ethiopia-yirgacheffe/')) {
        return jsonResponse(config, 200, detail)
      }
      return jsonResponse(config, 200, listPage([{ ...listItem, slug: 'other' }], null))
    })

    const { router } = renderProductPage('/product/ethiopia-yirgacheffe')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/coffee')
    })
    expect(router.state.location.search).toBe('')
  })

  it('offers a way back to the catalog when the product is gone', async () => {
    const user = userEvent.setup()
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError(
        'Not Found',
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        jsonResponse(config, 404, { detail: 'Не найдено', code: 'not_found' }),
      )
    })

    const { router } = renderProductPage('/product/gone-forever')

    expect(await screen.findByText('Не нашли такой товар')).toBeInTheDocument()
    const backLink = screen.getByRole('link', { name: 'Вернуться в каталог' })
    expect(backLink).toHaveAttribute('href', '/coffee')
    await user.click(backLink)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/coffee')
    })
  })

  it('shows a retry action when the detail request fails', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError(
        'Server Error',
        AxiosError.ERR_BAD_RESPONSE,
        config,
        null,
        jsonResponse(config, 500, { detail: 'boom', code: 'server_error' }),
      )
    })

    renderProductPage('/product/ethiopia-yirgacheffe')

    expect(await screen.findByText('Не удалось открыть товар')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Попробовать ещё раз' }),
    ).toBeInTheDocument()
  })
})

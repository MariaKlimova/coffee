import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@shared/api'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'

import { SimilarProducts } from './SimilarProducts'

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

const relatedItem = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Бразилия Сантос',
  slug: 'brazil-santos',
  short_description: 'Ореховый вкус',
  price: '990.00',
  old_price: null,
  category: 'coffee' as const,
  in_stock: true,
  image_url: 'https://example.com/brazil.jpg',
  is_favorite: false,
}

describe('SimilarProducts', () => {
  const adapter = vi.fn()
  const onSelect = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    onSelect.mockReset()
    http.defaults.adapter = adapter
  })

  afterEach(() => {
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('renders related cards from the API response', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, [relatedItem]),
    )

    renderWithProviders(
      <SimilarProducts slug="ethiopia-yirgacheffe" onSelect={onSelect} />,
    )

    expect(
      await screen.findByRole('heading', { name: 'Похожие товары' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Бразилия Сантос' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Лента похожих товаров' }),
    ).toBeInTheDocument()
  })

  it('hides the section when the related list is empty', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, []),
    )

    const { container } = renderWithProviders(
      <SimilarProducts slug="ethiopia-yirgacheffe" onSelect={onSelect} />,
    )

    await waitFor(() => {
      expect(adapter).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement()
    })
  })

  it('hides the section when the related request fails', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError(
        'Server Error',
        AxiosError.ERR_BAD_RESPONSE,
        config,
        null,
        jsonResponse(config, 500, { detail: 'boom', code: 'server_error' }),
      )
    })

    const { container } = renderWithProviders(
      <SimilarProducts slug="ethiopia-yirgacheffe" onSelect={onSelect} />,
    )

    await waitFor(() => {
      expect(adapter).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement()
    })
  })

  it('calls onSelect with the chosen product slug', async () => {
    const user = userEvent.setup()
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, [relatedItem]),
    )

    renderWithProviders(
      <SimilarProducts slug="ethiopia-yirgacheffe" onSelect={onSelect} />,
    )

    await screen.findByRole('heading', { name: 'Бразилия Сантос' })
    await user.click(screen.getByRole('button', { name: 'Бразилия Сантос' }))

    expect(onSelect).toHaveBeenCalledWith('brazil-santos')
  })
})

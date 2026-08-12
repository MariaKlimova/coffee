import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { productKeys } from '@entities/product'
import { useAuthStore } from '@entities/user'
import { http } from '@shared/api'
import { ToastProvider } from '@shared/ui'

import { FAVORITE_COPY, useToggleFavorite } from './index'

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

const productId = '11111111-1111-1111-1111-111111111111'

const listItem = {
  id: productId,
  name: 'Эфиопия Иргачеффе',
  slug: 'ethiopia-yirgacheffe',
  short_description: 'Цветочный аромат',
  price: '1290.00',
  old_price: null,
  category: 'coffee' as const,
  in_stock: true,
  image_url: null,
  is_favorite: false,
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    )
  }
}

describe('useToggleFavorite', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
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

  it('shows a guest toast and does not call the API', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const { result } = renderHook(() => useToggleFavorite(), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.toggleFavorite(productId, false)
    })

    expect(adapter).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(document.body.textContent).toContain(FAVORITE_COPY.guestHint)
    })
  })

  it('optimistically flips is_favorite in the product list cache', async () => {
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

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/api/favorites/') && config.method === 'post') {
        return jsonResponse(config, 201, {
          product_id: productId,
          created_at: '2026-01-01T00:00:00Z',
        })
      }
      return jsonResponse(config, 200, {
        count: 1,
        next: null,
        previous: null,
        results: [{ ...listItem, is_favorite: true }],
      })
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    queryClient.setQueryData(productKeys.list({ category: 'coffee' }), {
      count: 1,
      next: null,
      previous: null,
      results: [listItem],
    })

    const { result } = renderHook(() => useToggleFavorite(), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.toggleFavorite(productId, false)
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData(
        productKeys.list({ category: 'coffee' }),
      ) as {
        results: Array<{ is_favorite: boolean }>
      }
      expect(cached.results[0]?.is_favorite).toBe(true)
    })
  })

  it('rolls back the cache and shows an error toast on failure', async () => {
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

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/api/favorites/')) {
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

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    queryClient.setQueryData(productKeys.list({ category: 'coffee' }), {
      count: 1,
      next: null,
      previous: null,
      results: [listItem],
    })

    const { result } = renderHook(() => useToggleFavorite(), {
      wrapper: createWrapper(queryClient),
    })

    act(() => {
      result.current.toggleFavorite(productId, false)
    })

    await waitFor(() => {
      expect(document.body.textContent).toContain(FAVORITE_COPY.error)
    })

    const cached = queryClient.getQueryData(
      productKeys.list({ category: 'coffee' }),
    ) as {
      results: Array<{ is_favorite: boolean }>
    }
    expect(cached.results[0]?.is_favorite).toBe(false)
  })
})

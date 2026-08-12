import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@entities/user'
import { http } from '@shared/api'

import { useFavoritesCount } from './favoriteQueries'
import { favoriteKeys } from './favoriteQueryOptions'

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

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useFavoritesCount', () => {
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

  it('does not request favorites for a guest', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    renderHook(() => useFavoritesCount(), { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(adapter).not.toHaveBeenCalled()
    })
  })

  it('loads the total count for an authenticated user', async () => {
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

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        count: 3,
        next: null,
        previous: null,
        results: [],
      }),
    )

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { result } = renderHook(() => useFavoritesCount(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.data).toBe(3)
    })

    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig
    expect(config.url).toContain('/api/favorites/')
    expect(config.params).toMatchObject({ page_size: '1' })
  })

  it('stops exposing count data for consumers after logout cache clear', async () => {
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

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        count: 3,
        next: null,
        previous: null,
        results: [],
      }),
    )

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { result, rerender } = renderHook(() => useFavoritesCount(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.data).toBe(3)
    })

    queryClient.removeQueries({ queryKey: favoriteKeys.all })
    useAuthStore.setState({
      status: 'guest',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
    rerender()

    await waitFor(() => {
      expect(result.current.data).toBeUndefined()
      expect(adapter.mock.calls.length).toBe(1)
    })
  })
})

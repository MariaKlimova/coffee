import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@entities/user'
import { http } from '@shared/api'

import { useOrders } from './orderQueries'
import { orderKeys } from './orderQueryOptions'

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

describe('useOrders', () => {
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

  it('does not request orders for a guest', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    renderHook(() => useOrders(), { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(adapter).not.toHaveBeenCalled()
    })
  })

  it('loads a paginated list for an authenticated user', async () => {
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

    const order = {
      id: '11111111-1111-1111-1111-111111111111',
      status: 'paid',
      total: '1290.00',
      created_at: '2026-09-19T10:00:00Z',
    }

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        count: 1,
        next: null,
        previous: null,
        results: [order],
      }),
    )

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { result } = renderHook(
      () => useOrders({ page: 2, page_size: 20 }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => {
      expect(result.current.data?.results).toEqual([order])
    })

    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig
    expect(config.url).toContain('/api/orders/')
    expect(config.params).toMatchObject({ page: '2', page_size: '20' })
    expect(queryClient.getQueryData(orderKeys.list({ page: 2, page_size: 20 }))).toEqual({
      count: 1,
      next: null,
      previous: null,
      results: [order],
    })
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bindAuthBridge, useAuthStore } from '@entities/user'
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
    bindAuthBridge()
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

  it('не подставляет список прежнего покупателя при смене сессии и позднем ответе', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'synthetic-a',
      refreshToken: 'synthetic-refresh-a',
      user: { id: 'account-a', email: 'synthetic-a@example.invalid' },
    })
    let release: (() => void) | undefined
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.Authorization === 'Bearer synthetic-a') {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return jsonResponse(config, 200, {
          count: 1,
          results: [{ id: 'PRIVATE-ORDER-A' }],
          next: null,
          previous: null,
        })
      }
      return jsonResponse(config, 200, {
        count: 1,
        results: [{ id: 'ORDER-B' }],
        next: null,
        previous: null,
      })
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useOrders(), { wrapper: createWrapper(client) })
    await waitFor(() => expect(release).toBeDefined())
    act(() =>
      useAuthStore.getState().setSession({
        accessToken: 'synthetic-b',
        refreshToken: 'synthetic-refresh-b',
        user: { id: 'account-b', email: 'synthetic-b@example.invalid' },
      }),
    )
    await waitFor(() => expect(result.current.data?.results[0]?.id).toBe('ORDER-B'))
    await act(async () => {
      release?.()
      await Promise.resolve()
    })
    expect(result.current.data?.results[0]?.id).toBe('ORDER-B')
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data),
      ),
    ).not.toContain('PRIVATE-ORDER-A')
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

    const { result } = renderHook(() => useOrders({ page: 2, page_size: 20 }), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.data?.results).toEqual([order])
    })

    const config = adapter.mock.calls[0][0] as InternalAxiosRequestConfig
    expect(config.url).toContain('/api/orders/')
    expect(config.params).toMatchObject({ page: '2', page_size: '20' })
    expect(
      queryClient.getQueriesData({
        queryKey: orderKeys.list({ page: 2, page_size: 20 }),
      })[0]?.[1],
    ).toEqual({
      count: 1,
      next: null,
      previous: null,
      results: [order],
    })
  })
})

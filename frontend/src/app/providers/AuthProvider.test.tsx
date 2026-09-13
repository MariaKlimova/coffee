import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as cartEntity from '@entities/cart'
import { cartKeys, useCartStore } from '@entities/cart'
import { favoriteKeys } from '@entities/favorite'
import { useAuthStore } from '@entities/user'

import { AuthProvider } from './AuthProvider'

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    )
  }
}

describe('AuthProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
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
    useCartStore.setState({ cartToken: null })
  })

  it('removes favorite queries when the session becomes guest', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(favoriteKeys.count(), 5)

    render(<div />, { wrapper: createWrapper(queryClient) })

    act(() => {
      useAuthStore.setState({
        status: 'guest',
        accessToken: null,
        refreshToken: null,
        user: null,
      })
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(favoriteKeys.count())).toBeUndefined()
    })
  })

  it('merges guest cart and clears token when becoming authenticated', async () => {
    const mergeSpy = vi.spyOn(cartEntity, 'mergeCart').mockResolvedValue({
      id: 'cart-1',
      items: [],
      total: '0.00',
      items_count: 0,
      cart_token: null,
    })

    useAuthStore.setState({
      status: 'guest',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
    useCartStore.setState({ cartToken: 'guest-to-merge' })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(cartKeys.detail(), {
      id: 'guest-cart',
      items: [],
      total: '0.00',
      items_count: 0,
      cart_token: 'guest-to-merge',
    })

    render(<div />, { wrapper: createWrapper(queryClient) })

    act(() => {
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

    await waitFor(() => {
      expect(mergeSpy).toHaveBeenCalledWith('guest-to-merge')
      expect(useCartStore.getState().cartToken).toBeNull()
    })
  })

  it('removes cart queries when the session becomes guest', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(cartKeys.detail(), {
      id: 'cart-1',
      items: [],
      total: '0.00',
      items_count: 2,
      cart_token: null,
    })

    render(<div />, { wrapper: createWrapper(queryClient) })

    act(() => {
      useAuthStore.setState({
        status: 'guest',
        accessToken: null,
        refreshToken: null,
        user: null,
      })
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(cartKeys.detail())).toBeUndefined()
    })
  })
})

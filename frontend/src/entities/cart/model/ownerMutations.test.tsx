import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFavoriteMutation, favoriteKeys } from '@entities/favorite'
import { useAuthStore } from '@entities/user'
import { http } from '@shared/api'
import { useCartMutations } from './useCartMutations'
import { cartKeys } from './cartQueryOptions'

function renderMutations(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return {
    client,
    ...renderHook(
      () => ({ cart: useCartMutations(), favorite: useFavoriteMutation() }),
      { wrapper },
    ),
  }
}

const buyer = { id: 'buyer', email: 'buyer@example.invalid', is_staff: false }

describe('owner mutation boundary', () => {
  beforeEach(() =>
    useAuthStore.setState({
      status: 'authenticated',
      user: { ...buyer, is_staff: true },
      accessToken: 'access',
      refreshToken: 'refresh',
    }),
  )
  afterEach(() => {
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('sends no cart or favorite HTTP mutation even if a retained handler is invoked for staff', async () => {
    const adapter = vi.fn()
    http.defaults.adapter = adapter
    const { result } = renderMutations()
    await act(async () => {
      await expect(
        result.current.cart.addItem.mutateAsync({ productId: 'product', quantity: 1 }),
      ).rejects.toThrow()
      await expect(
        result.current.cart.updateItem.mutateAsync({ itemId: 'line', quantity: 2 }),
      ).rejects.toThrow()
      await expect(
        result.current.cart.removeItem.mutateAsync({ itemId: 'line' }),
      ).rejects.toThrow()
      await expect(
        result.current.favorite.mutateAsync({
          productId: 'product',
          isFavorite: false,
        }),
      ).rejects.toThrow()
    })
    expect(adapter).not.toHaveBeenCalled()
  })

  it('does not restore a buyer cache when an old request fails after switching to staff', async () => {
    useAuthStore.setState({ user: buyer })
    let rejectRequest!: (error: Error) => void
    const pending = new Promise<never>((_resolve, reject) => {
      rejectRequest = reject
    })
    const adapter = vi.fn(async () => pending)
    http.defaults.adapter = adapter
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    client.setQueryData(cartKeys.detail(), {
      id: 'private-buyer-cart',
      items: [],
      items_count: 0,
      total: '0.00',
    })
    client.setQueryData(favoriteKeys.count(), 8)
    const { result } = renderMutations(client)
    let completion!: Promise<unknown>
    await act(async () => {
      completion = result.current.cart.updateItem
        .mutateAsync({ itemId: 'line', quantity: 2 })
        .catch(() => undefined)
      await Promise.resolve()
    })
    expect(adapter).toHaveBeenCalledTimes(1)
    act(() => {
      useAuthStore.setState({ user: { ...buyer, is_staff: true } })
      client.removeQueries({ queryKey: cartKeys.all })
      client.removeQueries({ queryKey: favoriteKeys.all })
    })
    await act(async () => {
      rejectRequest(new Error('late failure'))
      await completion
    })
    expect(client.getQueryData(cartKeys.detail())).toBeUndefined()
    expect(client.getQueryData(favoriteKeys.count())).toBeUndefined()
  })
})

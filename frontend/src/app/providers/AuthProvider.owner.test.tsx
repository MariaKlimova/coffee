import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { InternalAxiosRequestConfig } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cartKeys, useCartStore } from '@entities/cart'
import { favoriteKeys } from '@entities/favorite'
import { bindAuthBridge, useAuthStore } from '@entities/user'
import { http } from '@shared/api'
import { RootLayout } from '../layouts/RootLayout'
import { AuthProvider } from './AuthProvider'

const owner = { id: 'owner', email: 'owner@example.invalid', is_staff: true }
const cart = {
  id: 'guest',
  items: [],
  items_count: 0,
  total: '0.00',
  cart_token: 'preserved-guest-token',
}
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({
  config,
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
})

function renderOwnerFlow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuthProvider>
          <RootLayout />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

describe('owner authentication policy and observers', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'guest',
      user: null,
      accessToken: null,
      refreshToken: null,
    })
    useCartStore.setState({ cartToken: 'preserved-guest-token' })
    bindAuthBridge()
  })
  afterEach(() => {
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('does not consume a guest cart or request buyer data when staff logs in, and restores guest shopping on logout', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
      response(
        config,
        config.url === '/api/auth/login/'
          ? { access: 'owner-access', refresh: 'owner-refresh', user: owner }
          : cart,
      ),
    )
    http.defaults.adapter = adapter
    const client = renderOwnerFlow()
    await waitFor(() =>
      expect(adapter.mock.calls.some(([c]) => c.url === '/api/cart/')).toBe(true),
    )
    const guestGets = adapter.mock.calls.filter(([c]) => c.url === '/api/cart/').length
    await act(async () => {
      await useAuthStore.getState().login({ email: owner.email, password: 'synthetic' })
    })
    await screen.findAllByRole('link', { name: 'Управление' })
    expect(
      screen.queryByRole('link', { name: /Корзина|Избранное|Заказы/ }),
    ).not.toBeInTheDocument()
    expect(adapter.mock.calls.filter(([c]) => c.url === '/api/cart/')).toHaveLength(
      guestGets,
    )
    expect(
      adapter.mock.calls.some(
        ([c]) => c.url === '/api/cart/merge/' || c.url === '/api/favorites/',
      ),
    ).toBe(false)
    expect(useCartStore.getState().cartToken).toBe('preserved-guest-token')
    expect(client.getQueryData(cartKeys.detail())).toBeUndefined()
    await act(async () => {
      await useAuthStore.getState().logout()
    })
    expect(await screen.findByRole('link', { name: 'Корзина: 0' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Управление' })).not.toBeInTheDocument()
    expect(useCartStore.getState().cartToken).toBe('preserved-guest-token')
  })

  it('keeps both pending restoration and resolved staff free of buyer observers and merge', async () => {
    useAuthStore.setState({ status: 'restoring', refreshToken: 'owner-refresh' })
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
      response(config, cart),
    )
    http.defaults.adapter = adapter
    renderOwnerFlow()
    expect(adapter).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('link', { name: /Корзина|Избранное/ }),
    ).not.toBeInTheDocument()
    act(() => {
      useAuthStore.getState().setSession({
        accessToken: 'owner-access',
        refreshToken: 'owner-refresh',
        user: owner,
      })
    })
    await screen.findAllByRole('link', { name: 'Управление' })
    expect(adapter).not.toHaveBeenCalled()
    expect(useCartStore.getState().cartToken).toBe('preserved-guest-token')
  })

  it('reacts to a staff role change without an auth-status change and clears previous buyer data', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { ...owner, is_staff: false },
      accessToken: 'access',
      refreshToken: 'refresh',
    })
    http.defaults.adapter = async (config) =>
      response(
        config,
        config.url === '/api/favorites/' ? { count: 3, results: [] } : cart,
      )
    const client = renderOwnerFlow()
    expect(
      await screen.findByRole('link', { name: 'Избранное: 3' }),
    ).toBeInTheDocument()
    act(() => {
      useAuthStore.setState({ user: owner })
    })
    await screen.findAllByRole('link', { name: 'Управление' })
    await waitFor(() => {
      expect(client.getQueryData(cartKeys.detail())).toBeUndefined()
      expect(client.getQueryData(favoriteKeys.count())).toBeUndefined()
    })
    expect(useCartStore.getState().cartToken).toBe('preserved-guest-token')
  })
})

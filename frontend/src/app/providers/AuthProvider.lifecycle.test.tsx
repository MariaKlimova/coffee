import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bindCartBridge, cartKeys, useCartStore } from '@entities/cart'
import { favoriteKeys } from '@entities/favorite'
import { bindAuthBridge, useAuthStore } from '@entities/user'
import { CartPage } from '@pages/CartPage'
import { CheckoutPage } from '@pages/CheckoutPage'
import { http } from '@shared/api'
import { CART_PAGE_COPY, CHECKOUT_COPY, FAVORITES_PAGE_COPY } from '@shared/lib/copy'
import { ToastProvider } from '@shared/ui/Toast'

import { AuthProvider } from './AuthProvider'
import { RootLayout } from '../layouts/RootLayout/RootLayout'

const emptyCart = {
  id: 'guest-cart',
  items: [],
  total: '0.00',
  items_count: 0,
  cart_token: 'guest-token',
}

const user = { id: 'u1', email: 'a@b.c', first_name: 'A', last_name: 'B' }
const userCart = {
  ...emptyCart,
  id: 'user-cart',
  cart_token: null,
  items_count: 1,
  total: '500.00',
  items: [
    {
      id: 'line-1',
      quantity: 1,
      line_total: '500.00',
      product: {
        id: 'product-1',
        name: 'Приватный кофе',
        slug: 'private-coffee',
        short_description: '',
        price: '500.00',
        old_price: null,
        category: 'coffee' as const,
        in_stock: true,
        image_url: null,
        is_favorite: false,
      },
    },
  ],
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function setAuthenticated() {
  useAuthStore.getState().setSession({
    accessToken: 'access',
    refreshToken: 'refresh',
    user,
  })
}

function response(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { config, data, status: 200, statusText: 'OK', headers: {} }
}

function renderCart(initialPath = '/cart') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter(
    [
      {
        element: <RootLayout />,
        children: [
          { path: '/cart', element: <CartPage /> },
          { path: '/checkout', element: <CheckoutPage /> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { client, router }
}

async function expectEmptyCart() {
  expect(
    await screen.findByRole('heading', { name: CART_PAGE_COPY.emptyTitle }),
  ).toBeInTheDocument()
  expect(screen.queryByLabelText(CART_PAGE_COPY.loadingLabel)).not.toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: `${CART_PAGE_COPY.title}: 0` }),
  ).toBeInTheDocument()
}

describe('AuthProvider: active cart lifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useAuthStore.setState({
      status: 'idle',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
    useCartStore.setState({ cartToken: null })
    bindAuthBridge()
    bindCartBridge()
  })

  afterEach(() => {
    cleanup()
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('finishes a hard-mounted guest cart after its HTTP response resolves', async () => {
    let finishCart!: () => void
    const gate = new Promise<void>((resolve) => {
      finishCart = resolve
    })
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      await gate
      return response(config, emptyCart)
    })
    http.defaults.adapter = adapter

    const { client } = renderCart()
    await waitFor(() => expect(adapter).toHaveBeenCalled())
    expect(screen.getByLabelText(CART_PAGE_COPY.loadingLabel)).toBeInTheDocument()

    await act(async () => {
      finishCart()
      await gate
    })

    await expectEmptyCart()
    expect(client.getQueryData(cartKeys.detail())).toEqual(emptyCart)
    expect(useCartStore.getState().cartToken).toBe('guest-token')
  })

  it('finishes an immediately resolved guest cart for both header and page', async () => {
    http.defaults.adapter = async (config) => response(config, emptyCart)
    renderCart()
    await expectEmptyCart()
  })

  it('shows an error instead of leaving the bootstrapped cart in a skeleton', async () => {
    http.defaults.adapter = async () => {
      throw new Error('Cart unavailable')
    }
    renderCart()
    expect(
      await screen.findByRole('heading', { name: CART_PAGE_COPY.errorTitle }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(CART_PAGE_COPY.loadingLabel)).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: `${CART_PAGE_COPY.title}: 0` }),
    ).toBeInTheDocument()
  })

  it('redirects a hard-mounted empty checkout to the completed guest cart', async () => {
    http.defaults.adapter = async (config) => response(config, emptyCart)
    const { router } = renderCart('/checkout')
    await expectEmptyCart()
    expect(router.state.location.pathname).toBe('/cart')
  })

  it('keeps a hard-mounted guest checkout with items and its guest token', async () => {
    useCartStore.getState().setCartToken('guest-token')
    http.defaults.adapter = async (config) => {
      expect(config.headers['X-Cart-Token']).toBe('guest-token')
      return response(config, { ...userCart, cart_token: 'guest-token' })
    }
    const { router } = renderCart('/checkout')
    expect(
      await screen.findByRole('button', { name: CHECKOUT_COPY.pay }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: `${CART_PAGE_COPY.title}: 1` }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/checkout')
    expect(useCartStore.getState().cartToken).toBe('guest-token')
  })

  it('restores authentication before fetching the user cart and favorites', async () => {
    useAuthStore.setState({ refreshToken: 'refresh' })
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'restored-access' } })
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/auth/me/') {
        if (!config.headers.Authorization) {
          throw new AxiosError('Unauthorized', '401', config, null, {
            ...response(config, {}),
            status: 401,
          })
        }
        return response(config, user)
      }
      expect(config.headers.Authorization).toBe('Bearer restored-access')
      return response(
        config,
        config.url === '/api/cart/' ? userCart : { count: 3, results: [] },
      )
    })
    http.defaults.adapter = adapter
    const { client } = renderCart()
    expect(
      await screen.findByRole('link', { name: userCart.items[0].product.name }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: `${CART_PAGE_COPY.title}: 1` }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('link', { name: `${FAVORITES_PAGE_COPY.title}: 3` }),
    ).toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(client.getQueryData(cartKeys.detail())).toEqual(userCart)
  })

  it('finishes the guest cart after failed restore instead of orphaning its observers', async () => {
    useAuthStore.setState({ refreshToken: 'expired-refresh' })
    const restoreGate = deferred()
    http.defaults.adapter = async (config) => {
      if (config.url === '/api/auth/me/') {
        await restoreGate.promise
        throw new Error('Restore unavailable')
      }
      return response(config, emptyCart)
    }
    const { client } = renderCart()
    await waitFor(() => expect(useAuthStore.getState().status).toBe('restoring'))
    expect(client.getQueryData(cartKeys.detail())).toBeUndefined()
    await act(async () => {
      restoreGate.resolve()
      await restoreGate.promise
    })
    await expectEmptyCart()
    expect(useAuthStore.getState().refreshToken).toBeNull()
  })

  it.each([false, true])(
    'clears user data on logout while old fetch pending=%s',
    async (pending) => {
      setAuthenticated()
      const oldGate = deferred()
      const guestGate = deferred()
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
        if (config.url === '/api/auth/logout/') return response(config, {})
        if (config.headers.Authorization) {
          if (pending) await oldGate.promise
          return response(
            config,
            config.url === '/api/cart/' ? userCart : { count: 3, results: [] },
          )
        }
        await guestGate.promise
        return response(config, emptyCart)
      })
      http.defaults.adapter = adapter
      const { client } = renderCart()
      if (pending) {
        await waitFor(() => expect(adapter).toHaveBeenCalledTimes(2))
      } else {
        await screen.findByRole('link', { name: userCart.items[0].product.name })
      }
      await act(async () => {
        await useAuthStore.getState().logout()
      })
      if (pending) {
        expect(
          adapter.mock.calls.find(([config]) => config.url === '/api/cart/')?.[0].signal
            ?.aborted,
        ).toBe(true)
      }
      expect(client.getQueryData(cartKeys.detail())).toBeUndefined()
      expect(client.getQueryData(favoriteKeys.count())).toBeUndefined()
      await waitFor(() => {
        expect(
          screen.queryByRole('link', { name: userCart.items[0].product.name }),
        ).not.toBeInTheDocument()
      })
      await act(async () => {
        oldGate.resolve()
        await oldGate.promise
      })
      expect(client.getQueryData(cartKeys.detail())).toBeUndefined()
      expect(client.getQueryData(favoriteKeys.count())).toBeUndefined()
      await act(async () => {
        guestGate.resolve()
        await guestGate.promise
      })
      await expectEmptyCart()
      expect(client.getQueryData(cartKeys.detail())).toEqual(emptyCart)
      expect(client.getQueryData(favoriteKeys.count())).toBeUndefined()
      expect(
        screen.getByRole('link', { name: `${FAVORITES_PAGE_COPY.title}: 0` }),
      ).toBeInTheDocument()
    },
  )

  it.each([false, true])(
    'preserves the guest token on merge failure=%s and loads the logged-in cart',
    async (mergeFails) => {
      useAuthStore.setState({ status: 'guest' })
      useCartStore.getState().setCartToken('guest-token')
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
        if (config.url === '/api/auth/login/')
          return response(config, { access: 'access', refresh: 'refresh', user })
        if (config.url === '/api/cart/merge/') {
          expect(JSON.parse(config.data as string)).toEqual({
            cart_token: 'guest-token',
          })
          if (mergeFails) throw new Error('Merge unavailable')
          return response(config, userCart)
        }
        if (config.url === '/api/favorites/')
          return response(config, { count: 3, results: [] })
        return response(config, config.headers.Authorization ? userCart : emptyCart)
      })
      http.defaults.adapter = adapter
      const { client } = renderCart()
      await expectEmptyCart()
      await act(async () => {
        await useAuthStore.getState().login({ email: user.email, password: 'password' })
      })
      expect(
        await screen.findByRole('link', { name: userCart.items[0].product.name }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: `${CART_PAGE_COPY.title}: 1` }),
      ).toBeInTheDocument()
      expect(
        await screen.findByRole('link', { name: `${FAVORITES_PAGE_COPY.title}: 3` }),
      ).toBeInTheDocument()
      expect(client.getQueryData(cartKeys.detail())).toEqual(userCart)
      expect(useCartStore.getState().cartToken).toBe(mergeFails ? 'guest-token' : null)
      expect(
        adapter.mock.calls.filter(([config]) => config.url === '/api/cart/merge/'),
      ).toHaveLength(1)
    },
  )

  it('does not reuse a pending guest response after login and merge', async () => {
    useAuthStore.setState({ status: 'guest' })
    useCartStore.getState().setCartToken('guest-token')
    const oldGuestGate = deferred()
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/auth/login/')
        return response(config, { access: 'access', refresh: 'refresh', user })
      if (config.url === '/api/cart/merge/') return response(config, userCart)
      if (config.url === '/api/favorites/')
        return response(config, { count: 3, results: [] })
      if (!config.headers.Authorization) {
        await oldGuestGate.promise
        return response(config, emptyCart)
      }
      return response(config, userCart)
    })
    http.defaults.adapter = adapter
    const { client } = renderCart()
    await waitFor(() => expect(adapter).toHaveBeenCalledTimes(1))
    await act(async () => {
      await useAuthStore.getState().login({ email: user.email, password: 'password' })
    })
    expect(adapter.mock.calls[0][0].signal?.aborted).toBe(true)
    await act(async () => {
      oldGuestGate.resolve()
      await oldGuestGate.promise
    })
    expect(
      await screen.findByRole('link', { name: userCart.items[0].product.name }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: `${CART_PAGE_COPY.title}: 1` }),
    ).toBeInTheDocument()
    expect(client.getQueryData(cartKeys.detail())).toEqual(userCart)
    expect(useCartStore.getState().cartToken).toBeNull()
  })

  it.each([false, true])(
    'ignores a stale merge after logout and another login=%s',
    async (loginAgain) => {
      useAuthStore.setState({ status: 'guest' })
      useCartStore.getState().setCartToken('guest-token')
      const oldMergeGate = deferred()
      const newMergeGate = deferred()
      let loginCount = 0
      let mergeCount = 0
      let loggedOut = false
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
        if (config.url === '/api/auth/login/') {
          loginCount += 1
          return response(config, {
            access: `access-${loginCount}`,
            refresh: `refresh-${loginCount}`,
            user,
          })
        }
        if (config.url === '/api/auth/logout/') {
          loggedOut = true
          return response(config, {})
        }
        if (config.url === '/api/cart/merge/') {
          mergeCount += 1
          await (mergeCount === 1 ? oldMergeGate.promise : newMergeGate.promise)
          return response(config, userCart)
        }
        if (config.url === '/api/favorites/') {
          return response(config, { count: 0, results: [] })
        }
        if (config.headers.Authorization) return response(config, userCart)
        return response(config, {
          ...emptyCart,
          cart_token: loggedOut ? 'new-guest-token' : 'guest-token',
        })
      })
      http.defaults.adapter = adapter
      const { client } = renderCart()
      await expectEmptyCart()
      await act(async () => {
        await useAuthStore.getState().login({ email: user.email, password: 'password' })
      })
      await waitFor(() => expect(mergeCount).toBe(1))
      await act(async () => {
        await useAuthStore.getState().logout()
      })
      await waitFor(() =>
        expect(useCartStore.getState().cartToken).toBe('new-guest-token'),
      )
      await expectEmptyCart()
      if (loginAgain) {
        await act(async () => {
          await useAuthStore
            .getState()
            .login({ email: user.email, password: 'password' })
        })
        await waitFor(() => expect(mergeCount).toBe(2))
      }
      const before = client.getQueryData(cartKeys.detail())
      const cartRequests = adapter.mock.calls.filter(
        ([config]) => config.url === '/api/cart/',
      ).length
      await act(async () => {
        oldMergeGate.resolve()
        await oldMergeGate.promise
      })
      expect(useCartStore.getState().cartToken).toBe('new-guest-token')
      expect(client.getQueryData(cartKeys.detail())).toEqual(before)
      expect(
        adapter.mock.calls.filter(([config]) => config.url === '/api/cart/'),
      ).toHaveLength(cartRequests)
      expect(useAuthStore.getState().status).toBe(
        loginAgain ? 'authenticated' : 'guest',
      )
      if (loginAgain) {
        expect(useAuthStore.getState().refreshToken).toBe('refresh-2')
        await act(async () => {
          newMergeGate.resolve()
          await newMergeGate.promise
        })
        expect(
          await screen.findByRole('link', { name: userCart.items[0].product.name }),
        ).toBeInTheDocument()
        expect(useCartStore.getState().cartToken).toBeNull()
        expect(
          screen.getByRole('link', { name: `${CART_PAGE_COPY.title}: 1` }),
        ).toBeInTheDocument()
      } else {
        await expectEmptyCart()
      }
    },
  )

  it('clears only the captured guest token after a merge in the same session', async () => {
    useAuthStore.setState({ status: 'guest' })
    useCartStore.getState().setCartToken('guest-token')
    const mergeGate = deferred()
    let mergeStarted = false
    http.defaults.adapter = async (config) => {
      if (config.url === '/api/auth/login/') {
        return response(config, { access: 'access', refresh: 'refresh', user })
      }
      if (config.url === '/api/cart/merge/') {
        mergeStarted = true
        await mergeGate.promise
        return response(config, userCart)
      }
      if (config.url === '/api/favorites/') {
        return response(config, { count: 0, results: [] })
      }
      return response(config, config.headers.Authorization ? userCart : emptyCart)
    }
    renderCart()
    await expectEmptyCart()
    await act(async () => {
      await useAuthStore.getState().login({ email: user.email, password: 'password' })
    })
    await waitFor(() => expect(mergeStarted).toBe(true))
    useCartStore.getState().setCartToken('replacement-token')
    await act(async () => {
      mergeGate.resolve()
      await mergeGate.promise
    })
    expect(
      await screen.findByRole('link', { name: userCart.items[0].product.name }),
    ).toBeInTheDocument()
    expect(useCartStore.getState().cartToken).toBe('replacement-token')
    expect(
      screen.getByRole('link', { name: `${CART_PAGE_COPY.title}: 1` }),
    ).toBeInTheDocument()
  })
})

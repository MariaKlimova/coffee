import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFavoriteMutation, favoriteKeys } from '@entities/favorite'
import { productKeys } from '@entities/product'
import { bindAuthBridge, useAuthStore } from '@entities/user'
import { http, resetAuthBridge } from '@shared/api'
import { useCartMutations } from './useCartMutations'
import { cartKeys } from './cartQueryOptions'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const buyerA = { id: 'buyer-a', email: 'a@example.invalid', is_staff: false }
const buyerB = { id: 'buyer-b', email: 'b@example.invalid', is_staff: false }
const owner = { ...buyerA, is_staff: true }
const product = {
  id: 'product',
  name: 'Кофе',
  slug: 'coffee',
  category: 'coffee' as const,
  short_description: '',
  price: '500.00',
  in_stock: true,
  is_favorite: false,
  image_url: null,
}
const line = { id: 'line', product, quantity: 1, line_total: '500.00' }
const newActorCart = { id: 'new-actor-cart', items: [], items_count: 0, total: '0.00' }
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({
  config,
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
})

function login(user = buyerA) {
  useAuthStore.getState().setSession({
    accessToken: `access-${user.id}`,
    refreshToken: `refresh-${user.id}`,
    user,
  })
}

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

type Hooks = ReturnType<typeof renderMutations>['result']['current']
type Action =
  'cart add' | 'cart update' | 'cart remove' | 'favorite add' | 'favorite remove'
const actions: Action[] = [
  'cart add',
  'cart update',
  'cart remove',
  'favorite add',
  'favorite remove',
]

function invoke(
  hooks: Hooks,
  action: Action,
  callbacks: { onError: () => void; onSettled: () => void },
) {
  if (action === 'cart add')
    return hooks.cart.addItem.mutateAsync(
      { productId: 'product', quantity: 1 },
      callbacks,
    )
  if (action === 'cart update')
    return hooks.cart.updateItem.mutateAsync({ itemId: 'line', quantity: 2 }, callbacks)
  if (action === 'cart remove')
    return hooks.cart.removeItem.mutateAsync({ itemId: 'line' }, callbacks)
  return hooks.favorite.mutateAsync(
    { productId: 'product', isFavorite: action === 'favorite remove' },
    callbacks,
  )
}

const transitions = ['A→guest', 'A→B', 'A→logout/login A', 'owner→customer'] as const

function changeActor(transition: (typeof transitions)[number]) {
  if (transition === 'A→guest') useAuthStore.getState().clearSession()
  else if (transition === 'A→B') login(buyerB)
  else if (transition === 'A→logout/login A') {
    useAuthStore.getState().clearSession()
    login(buyerA)
  } else login(buyerA)
}

describe('actor-bound mutation execution with real TanStack Query', () => {
  beforeEach(() => {
    login()
    bindAuthBridge()
  })
  afterEach(() => {
    delete http.defaults.adapter
    resetAuthBridge()
    vi.restoreAllMocks()
  })

  for (const action of actions) {
    it.each(transitions)(
      `${action}: sends zero API calls for %s before delayed cancellation resolves`,
      async (transition) => {
        if (transition === 'owner→customer') login(owner)
        const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
          response(config, line),
        )
        http.defaults.adapter = adapter
        const { client, result } = renderMutations()
        const gate = deferred()
        const cancel = client.cancelQueries.bind(client)
        const delayedCancel = vi
          .spyOn(client, 'cancelQueries')
          .mockImplementation(async (...args) => {
            await gate.promise
            return cancel(...args)
          })
        const callbacks = { onError: vi.fn(), onSettled: vi.fn() }
        let completion!: Promise<unknown>
        await act(async () => {
          completion = invoke(result.current, action, callbacks).catch(
            (error: unknown) => error,
          )
          if (transition === 'owner→customer') changeActor(transition)
          await Promise.resolve()
        })
        if (transition !== 'owner→customer') {
          await waitFor(() => expect(delayedCancel).toHaveBeenCalled())
          act(() => {
            changeActor(transition)
          })
        }
        client.setQueryData(cartKeys.detail(), newActorCart)
        client.setQueryData(favoriteKeys.count(), 7)
        client.setQueryData(productKeys.detail('coffee'), product)
        let failure: unknown
        await act(async () => {
          gate.resolve()
          failure = await completion
        })
        expect(failure).toBeInstanceOf(Error)
        expect(adapter).not.toHaveBeenCalled()
        expect(client.getQueryData(cartKeys.detail())).toEqual(newActorCart)
        expect(client.getQueryData(favoriteKeys.count())).toBe(7)
        expect(client.getQueryData(productKeys.detail('coffee'))).toEqual(product)
        expect(callbacks.onError).not.toHaveBeenCalled()
        expect(callbacks.onSettled).not.toHaveBeenCalled()
      },
    )
  }

  it.each(actions)(
    '%s: rejects at actual transport dispatch if actor changes inside an async Axios interceptor',
    async (action) => {
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
        response(config, line),
      )
      http.defaults.adapter = adapter
      const { result } = renderMutations()
      const gate = deferred()
      const entered = vi.fn()
      const interceptor = http.interceptors.request.use(async (config) => {
        entered()
        await gate.promise
        return config
      })
      const callbacks = { onError: vi.fn(), onSettled: vi.fn() }
      try {
        let completion!: Promise<unknown>
        await act(async () => {
          completion = invoke(result.current, action, callbacks).catch(
            (error: unknown) => error,
          )
          await Promise.resolve()
        })
        await waitFor(() => expect(entered).toHaveBeenCalled())
        act(() => {
          login(buyerB)
        })
        await act(async () => {
          gate.resolve()
          expect(await completion).toBeInstanceOf(Error)
        })
        expect(adapter).not.toHaveBeenCalled()
        expect(callbacks.onError).not.toHaveBeenCalled()
        expect(callbacks.onSettled).not.toHaveBeenCalled()
      } finally {
        gate.resolve()
        http.interceptors.request.eject(interceptor)
      }
    },
  )

  it.each(actions)(
    '%s: rejects a paused mutation when a different buyer resumes the queue',
    async (action) => {
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
        response(config, line),
      )
      http.defaults.adapter = adapter
      onlineManager.setOnline(false)
      const { result } = renderMutations()
      const callbacks = { onError: vi.fn(), onSettled: vi.fn() }
      try {
        let completion!: Promise<unknown>
        await act(async () => {
          completion = invoke(result.current, action, callbacks).catch(
            (error: unknown) => error,
          )
          await Promise.resolve()
        })
        await waitFor(() =>
          expect(
            action.startsWith('cart')
              ? Object.values(result.current.cart).some((mutation) => mutation.isPaused)
              : result.current.favorite.isPaused,
          ).toBe(true),
        )
        act(() => {
          login(buyerB)
          onlineManager.setOnline(true)
        })
        await act(async () => {
          expect(await completion).toBeInstanceOf(Error)
        })
        expect(adapter).not.toHaveBeenCalled()
        expect(callbacks.onError).not.toHaveBeenCalled()
        expect(callbacks.onSettled).not.toHaveBeenCalled()
      } finally {
        onlineManager.setOnline(true)
      }
    },
  )

  it.each(actions)(
    '%s: retains legitimate buyer operations in the same session',
    async (action) => {
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
        response(config, line),
      )
      http.defaults.adapter = adapter
      const { result } = renderMutations()
      await act(async () => {
        await invoke(result.current, action, { onError: vi.fn(), onSettled: vi.fn() })
      })
      expect(adapter).toHaveBeenCalledTimes(1)
      expect(adapter.mock.calls[0][0].headers.Authorization).toBe(
        'Bearer access-buyer-a',
      )
    },
  )

  it.each(['cart add', 'cart update', 'cart remove'] as const)(
    '%s: retains legitimate guest operations',
    async (action) => {
      useAuthStore.getState().clearSession()
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
        response(config, line),
      )
      http.defaults.adapter = adapter
      const { result } = renderMutations()
      await act(async () => {
        await invoke(result.current, action, { onError: vi.fn(), onSettled: vi.fn() })
      })
      expect(adapter).toHaveBeenCalledTimes(1)
      expect(adapter.mock.calls[0][0].headers.Authorization).toBeUndefined()
    },
  )

  it('allows same-session 401 → refresh → retry with synthetic refresh rotation (the current API rotates access only)', async () => {
    const generation = useAuthStore.getState().sessionGeneration
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.Authorization !== 'Bearer fresh-access')
        throw new AxiosError('Expired', '401', config, null, {
          ...response(config, {}),
          status: 401,
        })
      return response(config, line)
    })
    http.defaults.adapter = adapter
    const refresh = vi.spyOn(axios, 'post').mockImplementation(async () => {
      useAuthStore.setState({ refreshToken: 'rotated-same-session-refresh' })
      return { data: { access: 'fresh-access' } }
    })
    const { result } = renderMutations()
    await act(async () => {
      await result.current.cart.addItem.mutateAsync({
        productId: 'product',
        quantity: 1,
      })
    })
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().sessionGeneration).toBe(generation)
    expect(useAuthStore.getState().accessToken).toBe('fresh-access')
    await waitFor(() => expect(result.current.cart.addItem.isSuccess).toBe(true))
  })
})

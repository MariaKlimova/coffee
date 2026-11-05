import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import type { FormEvent, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCartStore } from '@entities/cart'
import {
  readGuestCheckoutIntent,
  readGuestOrderProof,
  writeGuestCheckoutIntent,
} from '@entities/order'
import { bindAuthBridge, useAuthStore } from '@entities/user'
import { http, setCartBridge } from '@shared/api'

import { clearPendingOrderId } from './pendingOrderId'
import { useCheckoutSubmit } from './useCheckoutSubmit'

const originalAdapter = http.defaults.adapter
const originalCart = 'synthetic-original-checkout-cart'
const secret = 'synthetic-issued-capability'
const order = {
  id: 'synthetic-checkout-order',
  status: 'pending',
  total: '500.00',
  delivery_address: 'Синтетический адрес',
  items: [],
  created_at: '2026-11-05T10:00:00Z',
  updated_at: '2026-11-05T10:00:00Z',
}
const values = {
  deliveryAddress: 'Синтетический адрес',
  email: 'synthetic@example.invalid',
  phone: '123',
}
const event = () =>
  ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>
function response(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: '', headers: new AxiosHeaders() }
}
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  )
}
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useAuthStore.setState({
    status: 'guest',
    user: null,
    accessToken: null,
    refreshToken: null,
    sessionGeneration: 1,
  })
  useCartStore.setState({ cartToken: originalCart })
  bindAuthBridge()
  setCartBridge({
    getCartToken: () => useCartStore.getState().cartToken,
    setCartToken: (token) => useCartStore.setState({ cartToken: token }),
  })
})
afterEach(() => {
  http.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('Гостевое оформление и потерянный ответ', () => {
  it('при замене исходной корзины оставляет recovery, но не переоформляет содержимое другой корзины', async () => {
    const saved = {
      checkoutRequestId: 'synthetic-original-id',
      originalCartToken: originalCart,
      createBody: {
        delivery_address: values.deliveryAddress,
        guest_email: values.email,
        guest_phone: values.phone,
      },
    }
    writeGuestCheckoutIntent(saved)
    useCartStore.setState({ cartToken: 'synthetic-replacement-cart' })
    let creates = 0
    let recoveries = 0
    http.defaults.adapter = async (config) => {
      if (config.url === '/api/orders/') creates++
      if (config.url === '/api/orders/checkout-recovery/') recoveries++
      expect(config.headers.get('X-Cart-Token')).toBe(originalCart)
      throw new AxiosError('missing', 'ERR', config, undefined, {
        ...response(config, {}),
        status: 404,
      })
    }
    const view = renderHook(() => useCheckoutSubmit({ isGuest: true }), { wrapper })
    await act(async () => {
      await view.result.current.recoverCheckout()
    })
    expect(view.result.current.canRetryGuestCheckout).toBe(false)
    expect(view.result.current.retryCartChanged).toBe(true)
    await act(async () => {
      await view.result.current.retryGuestCheckout()
    })
    expect(creates).toBe(0)
    expect(recoveries).toBe(1)
    expect(readGuestCheckoutIntent()).toEqual(saved)
  })
  it('после offline до API и recovery404 явно повторяет исходные UUID/тело/подтверждение, очищая временные контакты только после успеха', async () => {
    const posts: { body: unknown; proof: unknown }[] = []
    let recoveries = 0
    http.defaults.adapter = async (config) => {
      if (config.url === '/api/orders/checkout-recovery/') {
        recoveries++
        throw new AxiosError('not found', 'ERR', config, undefined, {
          ...response(config, { code: 'not_found' }),
          status: 404,
        })
      }
      posts.push({
        body: JSON.parse(config.data),
        proof: config.headers.get('X-Cart-Token'),
      })
      if (posts.length === 1)
        throw new AxiosError('offline before API', AxiosError.ERR_NETWORK, config)
      return response(config, {
        ...order,
        guest_action_token: secret,
        guest_action_version: 1,
      })
    }
    const first = renderHook(() => useCheckoutSubmit({ isGuest: true }), { wrapper })
    await act(async () => {
      await first.result.current.handleSubmit(event(), values)
    })
    const saved = readGuestCheckoutIntent()!
    expect(saved.createBody).toEqual({
      delivery_address: values.deliveryAddress,
      guest_email: values.email,
      guest_phone: values.phone,
    })
    first.unmount()
    const next = renderHook(() => useCheckoutSubmit({ isGuest: true }), { wrapper })
    await act(async () => {
      await next.result.current.retryGuestCheckout()
    })
    expect(posts).toHaveLength(1)
    await act(async () => {
      await next.result.current.recoverCheckout()
    })
    expect(next.result.current.canRetryGuestCheckout).toBe(true)
    await act(async () => {
      await next.result.current.handleSubmit(event(), {
        deliveryAddress: 'Другой адрес',
        email: 'changed@example.invalid',
        phone: '999',
      })
    })
    expect(posts).toHaveLength(1)
    await act(async () => {
      await next.result.current.retryGuestCheckout()
    })
    expect(posts).toHaveLength(2)
    expect(posts[1]).toEqual(posts[0])
    expect(recoveries).toBe(1)
    expect(next.result.current.createdOrderId).toBe(order.id)
    expect(readGuestCheckoutIntent()).toBeNull()
    expect(readGuestOrderProof(order.id)?.token).toBe(secret)
    expect(JSON.stringify(readGuestOrderProof(order.id))).not.toContain(values.email)
    expect(JSON.stringify(readGuestOrderProof(order.id))).not.toContain(
      values.deliveryAddress,
    )
  })

  it('отложенный первый create может завершиться после recovery404: повтор того же UUID получает409 и восстанавливает один заказ', async () => {
    const posts: string[] = []
    let releaseOriginal: (() => void) | undefined
    let committed = false
    let recoveries = 0
    const oldRedirect = vi.fn()
    http.defaults.adapter = async (config) => {
      if (config.url === '/api/orders/checkout-recovery/') {
        recoveries++
        if (!committed)
          throw new AxiosError('not found yet', 'ERR', config, undefined, {
            ...response(config, { code: 'not_found' }),
            status: 404,
          })
        return response(config, {
          order,
          guest_action_token: 'synthetic-rotated-capability',
          guest_action_version: 2,
        })
      }
      expect(config.url).toBe('/api/orders/')
      expect(config.headers.get('X-Cart-Token')).toBe(originalCart)
      posts.push(config.data)
      if (posts.length === 1) {
        await new Promise<void>((resolve) => {
          releaseOriginal = resolve
        })
        committed = true
        return response(config, {
          ...order,
          guest_action_token: secret,
          guest_action_version: 1,
        })
      }
      throw new AxiosError('recovery required', 'ERR', config, undefined, {
        ...response(config, { code: 'checkout_recovery_required' }),
        status: 409,
      })
    }
    const first = renderHook(
      () => useCheckoutSubmit({ isGuest: true, redirectToPayment: oldRedirect }),
      { wrapper },
    )
    let original: Promise<void> | undefined
    await act(async () => {
      original = first.result.current.handleSubmit(event(), values)
      await Promise.resolve()
    })
    expect(releaseOriginal).toBeDefined()
    first.unmount()
    const next = renderHook(() => useCheckoutSubmit({ isGuest: true }), { wrapper })
    await act(async () => {
      await next.result.current.recoverCheckout()
    })
    expect(next.result.current.canRetryGuestCheckout).toBe(true)
    await act(async () => {
      releaseOriginal?.()
      await original
    })
    expect(readGuestCheckoutIntent()).not.toBeNull()
    expect(oldRedirect).not.toHaveBeenCalled()
    await act(async () => {
      await next.result.current.retryGuestCheckout()
    })
    expect(posts).toHaveLength(2)
    expect(posts[1]).toBe(posts[0])
    expect(recoveries).toBe(2)
    expect(next.result.current.createdOrderId).toBe(order.id)
    expect(readGuestOrderProof(order.id)?.version).toBe(2)
  })

  it('повтор с изменившейся или недоступной исходной корзиной не заменяет её новой корзиной и не очищает UUID', async () => {
    const saved = {
      checkoutRequestId: 'synthetic-original-id',
      originalCartToken: originalCart,
      createBody: {
        delivery_address: values.deliveryAddress,
        guest_email: values.email,
        guest_phone: values.phone,
      },
    }
    writeGuestCheckoutIntent(saved)
    const posts: string[] = []
    http.defaults.adapter = async (config) => {
      if (config.url === '/api/orders/checkout-recovery/')
        throw new AxiosError('missing', 'ERR', config, undefined, {
          ...response(config, {}),
          status: 404,
        })
      posts.push(config.data)
      expect(config.headers.get('X-Cart-Token')).toBe(originalCart)
      throw new AxiosError('original cart unavailable', 'ERR', config, undefined, {
        ...response(config, { code: 'validation_error' }),
        status: 400,
      })
    }
    const view = renderHook(() => useCheckoutSubmit({ isGuest: true }), { wrapper })
    await act(async () => {
      await view.result.current.recoverCheckout()
    })
    await act(async () => {
      await view.result.current.retryGuestCheckout()
    })
    expect(posts).toHaveLength(1)
    expect(JSON.parse(posts[0]).checkout_request_id).toBe(saved.checkoutRequestId)
    expect(readGuestCheckoutIntent()).toEqual(saved)
    expect(view.result.current.createdOrderId).toBeNull()
  })

  it('старый callback явного повтора не отправляется после входа, а legacy intent без тела не переоформляет заказ', async () => {
    writeGuestCheckoutIntent({
      checkoutRequestId: 'synthetic-id',
      originalCartToken: originalCart,
      createBody: {
        delivery_address: values.deliveryAddress,
        guest_email: values.email,
        guest_phone: values.phone,
      },
    })
    let creates = 0
    http.defaults.adapter = async (config) => {
      if (config.url === '/api/orders/') creates++
      throw new AxiosError('missing', 'ERR', config, undefined, {
        ...response(config, {}),
        status: 404,
      })
    }
    const view = renderHook(() => useCheckoutSubmit({ isGuest: true }), { wrapper })
    await act(async () => {
      await view.result.current.recoverCheckout()
    })
    const oldRetry = view.result.current.retryGuestCheckout
    useAuthStore.getState().setSession({
      accessToken: 'synthetic-account',
      refreshToken: 'synthetic-refresh',
      user: { id: 'account-b', email: 'synthetic@example.invalid' },
    })
    await act(async () => {
      await oldRetry()
    })
    expect(creates).toBe(0)
    view.unmount()
    useAuthStore.getState().clearSession()
    writeGuestCheckoutIntent({
      checkoutRequestId: 'synthetic-legacy-intent',
      originalCartToken: originalCart,
    })
    const legacy = renderHook(() => useCheckoutSubmit({ isGuest: true }), { wrapper })
    await act(async () => {
      await legacy.result.current.recoverCheckout()
      await legacy.result.current.retryGuestCheckout()
    })
    expect(legacy.result.current.canRetryGuestCheckout).toBe(false)
    expect(creates).toBe(0)
  })
  it('сохраняет исходное намерение до POST, право до оплаты, не передаёт его провайдеру и не очищает после результата', async () => {
    const redirect = vi.fn()
    http.defaults.adapter = async (config) => {
      if (config.url === '/api/orders/') {
        const intent = readGuestCheckoutIntent()
        expect(intent?.originalCartToken).toBe(originalCart)
        expect(JSON.parse(config.data).checkout_request_id).toBe(
          intent?.checkoutRequestId,
        )
        return response(config, {
          ...order,
          guest_action_token: secret,
          guest_action_version: 1,
        })
      }
      expect(readGuestOrderProof(order.id)?.token).toBe(secret)
      expect(config.headers.get('X-Order-Action-Token')).toBeUndefined()
      expect(JSON.stringify(config.data)).not.toContain(secret)
      return response(config, {
        payment_url: 'https://synthetic-provider.invalid/payment',
      })
    }
    const { result } = renderHook(
      () => useCheckoutSubmit({ isGuest: true, redirectToPayment: redirect }),
      { wrapper },
    )
    await act(async () => {
      await result.current.handleSubmit(event(), values)
    })
    expect(redirect).toHaveBeenCalledWith('https://synthetic-provider.invalid/payment')
    clearPendingOrderId()
    expect(readGuestOrderProof(order.id)?.token).toBe(secret)
    expect(readGuestCheckoutIntent()).toBeNull()
  })

  it('после потерянного create и reload восстанавливает тот же заказ исходной корзиной, не создаёт второй', async () => {
    let creates = 0
    const headers: unknown[] = []
    http.defaults.adapter = async (config) => {
      if (config.url === '/api/orders/') {
        creates++
        throw new AxiosError('lost response', AxiosError.ERR_NETWORK, config)
      }
      headers.push(config.headers.get('X-Cart-Token'))
      expect(config.headers.Authorization).toBeUndefined()
      return response(config, {
        order,
        guest_action_token: secret,
        guest_action_version: 2,
      })
    }
    const first = renderHook(() => useCheckoutSubmit({ isGuest: true }), { wrapper })
    await act(async () => {
      await first.result.current.handleSubmit(event(), values)
    })
    expect(first.result.current.unresolvedGuestCheckout).not.toBeNull()
    first.unmount()
    useCartStore.setState({ cartToken: 'synthetic-new-cart-after-merge' })
    const next = renderHook(() => useCheckoutSubmit({ isGuest: true }), { wrapper })
    await act(async () => {
      await next.result.current.recoverCheckout()
    })
    expect(creates).toBe(1)
    expect(headers).toEqual([originalCart])
    expect(next.result.current.createdOrderId).toBe(order.id)
    expect(readGuestOrderProof(order.id)?.version).toBe(2)
    expect(readGuestCheckoutIntent()).toBeNull()
  })

  it('при недоступном durable storage не создаёт заказ и не начинает оплату', async () => {
    const adapter = vi.fn()
    http.defaults.adapter = adapter
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('synthetic storage failure')
    })
    const { result } = renderHook(() => useCheckoutSubmit({ isGuest: true }), {
      wrapper,
    })
    await act(async () => {
      await result.current.handleSubmit(event(), values)
    })
    expect(adapter).not.toHaveBeenCalled()
    expect(result.current.formError).toContain('сохранить доступ')
  })

  it('старые callbacks после входа не создают и не восстанавливают гостевой заказ', async () => {
    writeGuestCheckoutIntent({
      checkoutRequestId: 'synthetic-old-intent',
      originalCartToken: originalCart,
    })
    const adapter = vi.fn()
    http.defaults.adapter = adapter
    const { result } = renderHook(() => useCheckoutSubmit({ isGuest: true }), {
      wrapper,
    })
    const old = result.current
    useAuthStore.getState().setSession({
      accessToken: 'synthetic-account',
      refreshToken: 'synthetic-refresh',
      user: { id: 'account-b', email: 'synthetic@example.invalid' },
    })
    await act(async () => {
      await old.handleSubmit(event(), values)
      await old.recoverCheckout()
    })
    expect(adapter).not.toHaveBeenCalled()
  })
})

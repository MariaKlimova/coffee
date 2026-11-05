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

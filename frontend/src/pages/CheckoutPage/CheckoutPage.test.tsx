import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { useCartStore } from '@entities/cart'
import { writeGuestCheckoutIntent, readGuestOrderProof } from '@entities/order'
import { useAuthStore } from '@entities/user'
import { writePaymentRecoveryOrderId } from '@features/checkout'
import { http } from '@shared/api'
import { CANCELLATION_COPY, CHECKOUT_COPY, ORDER_RESULT_COPY } from '@shared/lib/copy'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'
import { ToastProvider } from '@shared/ui'

import { CheckoutPage } from './CheckoutPage'
import { CheckoutResultPage } from '../CheckoutResultPage'

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

const product = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Эфиопия Иргачеффе',
  slug: 'ethiopia-yirgacheffe',
  short_description: 'Цветочный аромат',
  price: '500.00',
  old_price: null,
  category: 'coffee' as const,
  in_stock: true,
  image_url: 'https://example.com/coffee.jpg',
  is_favorite: false,
}

const cartItem = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  product,
  quantity: 2,
  line_total: '1000.00',
}

const cartPayload = {
  id: 'cart-1',
  items: [cartItem],
  total: '1000.00',
  items_count: 1,
  cart_token: 'guest-token',
}

function renderCheckout(initialPath = '/checkout') {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/result" element={<CheckoutResultPage />} />
        <Route path="/cart" element={<div>Cart page</div>} />
      </Routes>
    </ToastProvider>,
    { initialEntries: [initialPath] },
  )
}

describe('CheckoutPage', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
    sessionStorage.clear()
    localStorage.clear()
    useCartStore.setState({ cartToken: 'guest-token' })
    useAuthStore.setState({
      status: 'guest',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
  })

  afterEach(() => {
    delete http.defaults.adapter
    sessionStorage.clear()
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each(['error', 'mismatch', 'late'] as const)(
    'не разрешает повтор без проверенного состава исходной корзины: %s',
    async (mode) => {
      writeGuestCheckoutIntent({
        checkoutRequestId: 'synthetic-retry-intent',
        originalCartToken: 'guest-token',
        createBody: {
          delivery_address: 'Сохранённый адрес',
          guest_email: 'saved@example.invalid',
          guest_phone: '123',
        },
      })
      let reads = 0
      let creates = 0
      let releaseCart: (() => void) | undefined
      adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (config.url === '/api/cart/') {
          reads++
          if (reads === 1) return jsonResponse(config, 200, cartPayload)
          if (mode === 'error')
            throw new AxiosError(
              'cart unavailable',
              'ERR',
              config,
              undefined,
              jsonResponse(config, 503, {}),
            )
          if (mode === 'mismatch')
            return jsonResponse(config, 200, {
              ...cartPayload,
              cart_token: 'synthetic-other-cart',
            })
          await new Promise<void>((resolve) => {
            releaseCart = resolve
          })
          return jsonResponse(config, 200, cartPayload)
        }
        if (config.url === '/api/orders/') creates++
        throw new AxiosError(
          'not found',
          'ERR',
          config,
          undefined,
          jsonResponse(config, 404, { code: 'not_found' }),
        )
      })
      renderCheckout()
      await screen.findByText(product.name)
      await userEvent.click(
        screen.getByRole('button', { name: CANCELLATION_COPY.check }),
      )
      await screen.findByText(CANCELLATION_COPY.checkoutNotFound)
      await waitFor(() => expect(reads).toBeGreaterThan(1))
      const retry = screen.queryByRole('button', {
        name: CANCELLATION_COPY.retryCheckout,
      })
      if (retry) expect(retry).toBeDisabled()
      expect(screen.queryByText(product.name)).not.toBeInTheDocument()
      expect(creates).toBe(0)
      if (mode === 'late') {
        await act(async () => {
          releaseCart?.()
          await Promise.resolve()
        })
        await waitFor(() =>
          expect(
            screen.getByRole('button', { name: CANCELLATION_COPY.retryCheckout }),
          ).toBeEnabled(),
        )
        expect(screen.getByText(product.name)).toBeVisible()
      }
    },
  )

  it('после offline до создания и reload показывает сохранённые данные и явный безопасный повтор', async () => {
    const creates: string[] = []
    let payments = 0
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/cart/') return jsonResponse(config, 200, cartPayload)
      if (config.url === '/api/orders/checkout-recovery/')
        throw new AxiosError(
          'not found',
          'ERR',
          config,
          undefined,
          jsonResponse(config, 404, { code: 'not_found' }),
        )
      if (config.url === '/api/orders/') {
        creates.push(config.data)
        expect(config.headers.get('X-Cart-Token')).toBe('guest-token')
        if (creates.length === 1)
          throw new AxiosError('offline before create', AxiosError.ERR_NETWORK, config)
        return jsonResponse(config, 201, {
          id: 'synthetic-retry-order',
          status: 'pending',
          guest_action_token: 'synthetic-retry-cap',
          guest_action_version: 1,
        })
      }
      if (config.url === '/api/payments/create/') payments++
      return jsonResponse(config, 200, {
        id: 'synthetic-retry-order',
        status: 'pending',
      })
    })
    const user = userEvent.setup()
    const first = renderCheckout()
    await user.type(
      await screen.findByLabelText(CHECKOUT_COPY.addressLabel),
      'Сохранённый адрес',
    )
    await user.type(
      screen.getByLabelText(CHECKOUT_COPY.emailLabel),
      'saved@example.invalid',
    )
    await user.type(screen.getByLabelText(CHECKOUT_COPY.phoneLabel), '123')
    await user.click(screen.getByRole('button', { name: CHECKOUT_COPY.pay }))
    await screen.findByText(CANCELLATION_COPY.checkoutRecoveryTitle)
    first.unmount()
    renderCheckout()
    expect(await screen.findByText('Сохранённый адрес')).toBeVisible()
    expect(screen.getByText('saved@example.invalid')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: CANCELLATION_COPY.retryCheckout }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: CANCELLATION_COPY.check }))
    await screen.findByText(CANCELLATION_COPY.checkoutNotFound)
    expect(
      screen.getByRole('link', { name: CANCELLATION_COPY.contactStore }),
    ).toHaveAttribute('href', '#contacts')
    expect(
      screen.getByRole('link', { name: CANCELLATION_COPY.contactStore }),
    ).not.toHaveAttribute('data-discover')
    const retry = screen.getByRole('button', { name: CANCELLATION_COPY.retryCheckout })
    await waitFor(() => expect(retry).toBeEnabled())
    expect(screen.getByText(CANCELLATION_COPY.retryCheckoutHint)).toBeVisible()
    await user.click(retry)
    await screen.findByRole('heading', { name: ORDER_RESULT_COPY.recoveryTitle })
    expect(creates).toHaveLength(2)
    expect(creates[1]).toBe(creates[0])
    expect(payments).toBe(0)
    expect(readGuestOrderProof('synthetic-retry-order')?.version).toBe(1)
  })

  it('проверяет потерянное оформление до редиректа из пустой корзины и открывает прежний заказ', async () => {
    writeGuestCheckoutIntent({
      checkoutRequestId: 'synthetic-lost-intent',
      originalCartToken: 'synthetic-original-cart',
    })
    useCartStore.setState({ cartToken: 'synthetic-current-cart' })
    const posts: string[] = []
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/cart/')
        return jsonResponse(config, 200, {
          ...cartPayload,
          items: [],
          total: '0.00',
          items_count: 0,
        })
      if (config.method === 'post') {
        posts.push(config.url ?? '')
        expect(config.url).toBe('/api/orders/checkout-recovery/')
        expect(config.headers.get('X-Cart-Token')).toBe('synthetic-original-cart')
        return jsonResponse(config, 200, {
          order: { id: 'synthetic-lost-order', status: 'pending' },
          guest_action_token: 'synthetic-recovered-cap',
          guest_action_version: 2,
        })
      }
      return jsonResponse(config, 200, {
        id: 'synthetic-lost-order',
        status: 'pending',
      })
    })
    const { router } = renderCheckout()
    expect(
      await screen.findByText(CANCELLATION_COPY.checkoutRecoveryTitle),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/checkout')
    await userEvent.click(screen.getByRole('button', { name: CANCELLATION_COPY.check }))
    expect(await screen.findByText(ORDER_RESULT_COPY.recoveryTitle)).toBeVisible()
    expect(posts).toEqual(['/api/orders/checkout-recovery/'])
    expect(router.state.location.pathname).toBe('/checkout/result')
    expect(readGuestOrderProof('synthetic-lost-order')?.version).toBe(2)
  })

  it('redirects to cart with toast when the cart is empty', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/api/cart/')) {
        return jsonResponse(config, 200, {
          ...cartPayload,
          items: [],
          total: '0.00',
          items_count: 0,
        })
      }
      throw new Error(`Unexpected ${config.url}`)
    })

    const { router } = renderCheckout()

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/cart')
    })
    expect(await screen.findByText(CHECKOUT_COPY.emptyCartToast)).toBeInTheDocument()
  })

  it('shows guest contact fields and pays via order then payment redirect', async () => {
    const user = userEvent.setup()
    let orderCalls = 0

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url?.includes('/api/cart/')) {
        return jsonResponse(
          config,
          200,
          orderCalls > 0
            ? { ...cartPayload, items: [], total: '0.00', items_count: 0 }
            : cartPayload,
        )
      }
      if (config.method === 'post' && config.url?.includes('/api/orders/')) {
        orderCalls += 1
        const body =
          typeof config.data === 'string' ? JSON.parse(config.data) : config.data
        expect(body).toEqual({
          checkout_request_id: expect.any(String),
          delivery_address: 'Москва, Тверская 1',
          guest_email: 'guest@example.com',
          guest_phone: '+79991234567',
        })
        return jsonResponse(config, 201, {
          id: 'order-1',
          guest_action_token: 'issued-order-proof',
          guest_action_version: 1,
          status: 'pending',
          total: '1000.00',
          created_at: '2026-01-01T00:00:00Z',
          delivery_address: 'Москва, Тверская 1',
          items: [],
          updated_at: '2026-01-01T00:00:00Z',
        })
      }
      if (config.method === 'post' && config.url?.includes('/api/payments/create/')) {
        return jsonResponse(config, 201, {
          id: 'pay-1',
          order_id: 'order-1',
          guest_action_token: 'issued-order-proof',
          guest_action_version: 1,
          status: 'pending',
          amount: '1000.00',
          payment_url: 'https://pay.example/session',
        })
      }
      throw new Error(`Unexpected ${config.method} ${config.url}`)
    })

    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })

    renderCheckout()

    expect(await screen.findByText(product.name)).toBeInTheDocument()
    expect(screen.getByLabelText(CHECKOUT_COPY.emailLabel)).toBeInTheDocument()
    expect(screen.getByLabelText(CHECKOUT_COPY.phoneLabel)).toBeInTheDocument()

    await user.type(
      screen.getByLabelText(CHECKOUT_COPY.addressLabel),
      'Москва, Тверская 1',
    )
    await user.type(
      screen.getByLabelText(CHECKOUT_COPY.emailLabel),
      'guest@example.com',
    )
    await user.type(screen.getByLabelText(CHECKOUT_COPY.phoneLabel), '+79991234567')
    await user.click(screen.getByRole('button', { name: CHECKOUT_COPY.pay }))

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://pay.example/session')
    })
    expect(orderCalls).toBe(1)
    expect(sessionStorage.getItem('coffee:pendingOrderId')).toBe('order-1')
  })

  it('hides guest fields for authenticated users', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: {
        id: 'u1',
        email: 'user@example.com',
      },
    })

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/api/cart/')) {
        return jsonResponse(config, 200, { ...cartPayload, cart_token: null })
      }
      throw new Error(`Unexpected ${config.url}`)
    })

    renderCheckout()

    expect(await screen.findByText(product.name)).toBeInTheDocument()
    expect(screen.queryByLabelText(CHECKOUT_COPY.emailLabel)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(CHECKOUT_COPY.phoneLabel)).not.toBeInTheDocument()
  })

  it('keeps form values and shows product names when order creation fails', async () => {
    const user = userEvent.setup()

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url?.includes('/api/cart/')) {
        return jsonResponse(config, 200, cartPayload)
      }
      if (config.method === 'post' && config.url?.includes('/api/orders/')) {
        return Promise.reject(
          new AxiosError(
            'Bad Request',
            AxiosError.ERR_BAD_REQUEST,
            config,
            null,
            jsonResponse(config, 400, {
              detail: 'Invalid input',
              code: 'validation_error',
              errors: {
                non_field_errors: ['Some items are unavailable: Эфиопия Иргачеффе.'],
                unavailable_products: ['Эфиопия Иргачеффе'],
              },
            }),
          ),
        )
      }
      throw new Error(`Unexpected ${config.method} ${config.url}`)
    })

    renderCheckout()

    await screen.findByText(product.name)
    await user.type(screen.getByLabelText(CHECKOUT_COPY.addressLabel), 'Адрес сохранён')
    await user.type(
      screen.getByLabelText(CHECKOUT_COPY.emailLabel),
      'guest@example.com',
    )
    await user.type(screen.getByLabelText(CHECKOUT_COPY.phoneLabel), '+79991234567')
    await user.click(screen.getByRole('button', { name: CHECKOUT_COPY.pay }))

    expect(
      await screen.findByText(/Эфиопия Иргачеффе/, { selector: '[role="alert"]' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(CHECKOUT_COPY.addressLabel)).toHaveValue(
      'Адрес сохранён',
    )
    expect(screen.getByLabelText(CHECKOUT_COPY.emailLabel)).toHaveValue(
      'guest@example.com',
    )
  })

  it('does not create a second order on double submit', async () => {
    const user = userEvent.setup()
    let orderCalls = 0
    let resolveOrder: ((value: AxiosResponse) => void) | undefined

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url?.includes('/api/cart/')) {
        return jsonResponse(config, 200, cartPayload)
      }
      if (config.method === 'post' && config.url?.includes('/api/orders/')) {
        orderCalls += 1
        return new Promise((resolve) => {
          resolveOrder = resolve
        })
      }
      if (config.method === 'post' && config.url?.includes('/api/payments/create/')) {
        return jsonResponse(config, 201, {
          id: 'pay-1',
          order_id: 'order-1',
          guest_action_token: 'issued-order-proof',
          guest_action_version: 1,
          status: 'pending',
          amount: '1000.00',
          payment_url: 'https://pay.example/session',
        })
      }
      throw new Error(`Unexpected ${config.method} ${config.url}`)
    })

    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })

    renderCheckout()
    await screen.findByText(product.name)

    await user.type(screen.getByLabelText(CHECKOUT_COPY.addressLabel), 'Москва')
    await user.type(screen.getByLabelText(CHECKOUT_COPY.emailLabel), 'a@b.c')
    await user.type(screen.getByLabelText(CHECKOUT_COPY.phoneLabel), '123')

    const payButton = await screen.findByRole('button', { name: CHECKOUT_COPY.pay })
    await user.click(payButton)
    await user.click(payButton)

    expect(orderCalls).toBe(1)

    resolveOrder?.(
      jsonResponse({} as InternalAxiosRequestConfig, 201, {
        id: 'order-1',
        guest_action_token: 'issued-order-proof',
        guest_action_version: 1,
        status: 'pending',
        total: '1000.00',
        created_at: '2026-01-01T00:00:00Z',
        delivery_address: 'Москва',
        items: [],
        updated_at: '2026-01-01T00:00:00Z',
      }),
    )

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://pay.example/session')
    })
  })

  it.each([
    ['guest', 'provider error'],
    ['guest', 'timeout'],
    ['authenticated', 'provider error'],
    ['authenticated', 'timeout'],
  ] as const)(
    'preserves %s order after cart empties and payment %s; retries the same order',
    async (authStatus, failure) => {
      const user = userEvent.setup()
      if (authStatus === 'authenticated') {
        useAuthStore.setState({
          status: authStatus,
          accessToken: 'access',
          refreshToken: 'refresh',
          user: { id: 'u1', email: 'user@example.com' },
        })
      }
      let orderCalls = 0
      let paymentCalls = 0
      let emptyCartReads = 0
      let rejectPayment: ((error: Error) => void) | undefined
      let resolveRetry: ((value: AxiosResponse) => void) | undefined
      const order = {
        id: 'order-recovery',
        guest_action_token: 'issued-order-proof',
        guest_action_version: 1,
        status: 'pending',
        total: '1000.00',
        items: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        delivery_address: 'Москва',
      }
      adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (config.method === 'get' && config.url === '/api/cart/') {
          if (orderCalls) {
            emptyCartReads += 1
            return jsonResponse(config, 200, {
              ...cartPayload,
              items: [],
              total: '0.00',
              items_count: 0,
            })
          }
          return jsonResponse(config, 200, cartPayload)
        }
        if (config.method === 'post' && config.url === '/api/orders/') {
          orderCalls += 1
          return jsonResponse(config, 201, order)
        }
        if (config.method === 'get' && config.url === `/api/orders/${order.id}/`) {
          return jsonResponse(config, 200, order)
        }
        if (config.method === 'post' && config.url === '/api/payments/create/') {
          paymentCalls += 1
          expect(JSON.parse(config.data)).toEqual({ order_id: order.id })
          expect(config.timeout).toBe(30_000)
          expect(sessionStorage.getItem('coffee:pendingOrderId')).toBe(order.id)
          if (paymentCalls === 1) {
            return new Promise((_resolve, reject) => {
              rejectPayment = reject
            })
          }
          return new Promise((resolve) => {
            resolveRetry = resolve
          })
        }
        throw new Error(`Unexpected ${config.method} ${config.url}`)
      })
      const assign = vi.fn()
      vi.stubGlobal('location', { ...window.location, assign })
      const { router } = renderCheckout()
      await screen.findByText(product.name)
      await user.type(screen.getByLabelText(CHECKOUT_COPY.addressLabel), 'Москва')
      if (authStatus === 'guest') {
        await user.type(
          screen.getByLabelText(CHECKOUT_COPY.emailLabel),
          'guest@example.com',
        )
        await user.type(screen.getByLabelText(CHECKOUT_COPY.phoneLabel), '123')
      }
      await user.dblClick(screen.getByRole('button', { name: CHECKOUT_COPY.pay }))
      await waitFor(() => {
        expect(emptyCartReads).toBeGreaterThan(0)
      })
      expect(router.state.location.pathname).toBe('/checkout')
      expect(router.state.location.search).toContain('order_id=order-recovery')
      expect(screen.queryByText('Cart page')).not.toBeInTheDocument()
      expect(screen.getByText(CHECKOUT_COPY.orderCreated)).toBeInTheDocument()
      expect(orderCalls).toBe(1)
      expect(paymentCalls).toBe(1)

      await act(async () => {
        rejectPayment?.(
          new AxiosError(
            'payment unavailable',
            failure === 'timeout'
              ? AxiosError.ECONNABORTED
              : AxiosError.ERR_BAD_RESPONSE,
          ),
        )
      })
      expect(
        await screen.findByRole('heading', { name: ORDER_RESULT_COPY.recoveryTitle }),
      ).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/checkout/result')
      expect(screen.getByText(`Номер заказа: ${order.id}`)).toBeInTheDocument()
      expect(screen.queryByText(ORDER_RESULT_COPY.pendingTitle)).not.toBeInTheDocument()
      expect(
        screen.getByText(ORDER_RESULT_COPY.recoveryDescription),
      ).toBeInTheDocument()

      await user.dblClick(
        screen.getByRole('button', { name: ORDER_RESULT_COPY.tryAgain }),
      )
      expect(paymentCalls).toBe(2)
      expect(orderCalls).toBe(1)
      await act(async () => {
        resolveRetry?.(
          jsonResponse({} as InternalAxiosRequestConfig, 201, {
            payment_url: 'https://pay.example/recovered',
          }),
        )
      })
      expect(assign).toHaveBeenCalledWith('https://pay.example/recovered')
    },
  )

  it.each(['session', 'query'] as const)(
    'restores guest order on checkout reload from %s without creating an order',
    async (source) => {
      const orderId = 'order-reload'
      if (source === 'session') writePaymentRecoveryOrderId(orderId)
      adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (config.method === 'get' && config.url === '/api/cart/') {
          return jsonResponse(config, 200, {
            ...cartPayload,
            items: [],
            total: '0.00',
            items_count: 0,
          })
        }
        if (config.method === 'get' && config.url === `/api/orders/${orderId}/`) {
          return jsonResponse(config, 200, { id: orderId, status: 'pending' })
        }
        throw new Error(`Unexpected ${config.method} ${config.url}`)
      })
      const { router } = renderCheckout(
        source === 'query'
          ? `/checkout?order_id=${orderId}&payment=recovery`
          : '/checkout',
      )
      expect(
        await screen.findByRole('heading', { name: ORDER_RESULT_COPY.recoveryTitle }),
      ).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/checkout/result')
      expect(adapter.mock.calls.every(([config]) => config.method === 'get')).toBe(true)
    },
  )

  it('lets the guest explicitly create a new order from a new cart while keeping the earlier order accessible', async () => {
    const user = userEvent.setup()
    writePaymentRecoveryOrderId('previous-order')
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url === '/api/cart/') {
        return jsonResponse(config, 200, cartPayload)
      }
      if (config.method === 'post' && config.url === '/api/orders/') {
        throw new AxiosError('unavailable', AxiosError.ERR_NETWORK)
      }
      throw new Error(`Unexpected ${config.method} ${config.url}`)
    })
    renderCheckout()
    expect(
      await screen.findByRole('heading', { name: CHECKOUT_COPY.savedOrderTitle }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: CHECKOUT_COPY.resumePayment }),
    ).toHaveAttribute(
      'href',
      '/checkout/result?order_id=previous-order&payment=recovery',
    )
    expect(adapter.mock.calls.every(([config]) => config.method === 'get')).toBe(true)
    await user.click(screen.getByRole('button', { name: CHECKOUT_COPY.newOrder }))
    expect(await screen.findByLabelText(CHECKOUT_COPY.addressLabel)).toBeInTheDocument()
    expect(sessionStorage.getItem('coffee:pendingOrderId')).toBe('previous-order')
    await user.type(screen.getByLabelText(CHECKOUT_COPY.addressLabel), 'Москва')
    await user.type(
      screen.getByLabelText(CHECKOUT_COPY.emailLabel),
      'guest@example.com',
    )
    await user.type(screen.getByLabelText(CHECKOUT_COPY.phoneLabel), '123')
    await user.click(screen.getByRole('button', { name: CHECKOUT_COPY.pay }))
    expect(await screen.findByText(CHECKOUT_COPY.formErrorGeneric)).toBeInTheDocument()
    expect(sessionStorage.getItem('coffee:pendingOrderId')).toBe('previous-order')
    expect(
      adapter.mock.calls.filter(
        ([config]) => config.method === 'post' && config.url === '/api/orders/',
      ),
    ).toHaveLength(1)
  })

  it('can resume the earlier order even with items in a new cart', async () => {
    writePaymentRecoveryOrderId('previous-order')
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.method === 'get' && config.url === '/api/cart/') {
        return jsonResponse(config, 200, cartPayload)
      }
      if (config.method === 'get' && config.url === '/api/orders/previous-order/') {
        return jsonResponse(config, 200, { id: 'previous-order', status: 'pending' })
      }
      throw new Error(`Unexpected ${config.method} ${config.url}`)
    })
    const { router } = renderCheckout()
    await userEvent.click(
      await screen.findByRole('link', { name: CHECKOUT_COPY.resumePayment }),
    )
    expect(
      await screen.findByRole('heading', { name: ORDER_RESULT_COPY.recoveryTitle }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toContain('order_id=previous-order')
    expect(adapter.mock.calls.every(([config]) => config.method === 'get')).toBe(true)
  })
})

import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { useCartStore } from '@entities/cart'
import { useAuthStore } from '@entities/user'
import { http } from '@shared/api'
import { CHECKOUT_COPY } from '@shared/lib/copy'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'
import { ToastProvider } from '@shared/ui'

import { CheckoutPage } from './CheckoutPage'

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
    vi.restoreAllMocks()
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
        return jsonResponse(config, 200, cartPayload)
      }
      if (config.method === 'post' && config.url?.includes('/api/orders/')) {
        orderCalls += 1
        const body =
          typeof config.data === 'string' ? JSON.parse(config.data) : config.data
        expect(body).toEqual({
          delivery_address: 'Москва, Тверская 1',
          guest_email: 'guest@example.com',
          guest_phone: '+79991234567',
        })
        return jsonResponse(config, 201, {
          id: 'order-1',
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
})

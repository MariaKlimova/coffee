import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'

import { useAuthStore } from '@entities/user'
import { http } from '@shared/api'
import { CART_COPY, CART_PAGE_COPY } from '@shared/lib/copy'
import { formatMoney } from '@shared/lib/formatMoney'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'

import { CartPage } from './CartPage'

/** RTL нормализует NBSP — сравниваем через textContent только у листа. */
function hasMoneyText(expected: string) {
  const formatted = formatMoney(expected)
  return (_content: string, element: Element | null) => {
    if (element == null || element.children.length > 0) {
      return false
    }
    return element.textContent === formatted
  }
}

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

const availableProduct = {
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

const unavailableProduct = {
  ...availableProduct,
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Бразилия Сантос',
  slug: 'brazil-santos',
  price: '300.00',
  in_stock: false,
}

const availableItem = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  product: availableProduct,
  quantity: 2,
  line_total: '1000.00',
}

const unavailableItem = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  product: unavailableProduct,
  quantity: 1,
  line_total: '300.00',
}

function cartPayload(items: Array<typeof availableItem | typeof unavailableItem>) {
  const total = items
    .reduce((sum, item) => sum + Number.parseFloat(item.line_total), 0)
    .toFixed(2)

  return {
    id: 'cart-1',
    items,
    total,
    items_count: items.length,
    cart_token: 'guest-token',
  }
}

function renderCart(initialPath = '/cart') {
  return renderWithProviders(
    <Routes>
      <Route path="/cart" element={<CartPage />} />
      <Route path="/coffee" element={<div>Каталог кофе</div>} />
      <Route path="/checkout" element={<div>Checkout stub</div>} />
      <Route path="/product/:slug" element={<div>Product page</div>} />
    </Routes>,
    { initialEntries: [initialPath] },
  )
}

describe('CartPage', () => {
  const adapter = vi.fn()

  beforeEach(() => {
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

  it('shows skeletons while loading, then cart items', async () => {
    let resolveCart!: (value: AxiosResponse) => void
    adapter.mockImplementation(
      (config: InternalAxiosRequestConfig) =>
        new Promise<AxiosResponse>((resolve) => {
          resolveCart = resolve
          void config
        }),
    )

    renderCart()

    expect(screen.getByLabelText(CART_PAGE_COPY.loadingLabel)).toBeInTheDocument()

    await waitFor(() => {
      expect(adapter).toHaveBeenCalled()
    })

    resolveCart(
      jsonResponse(
        adapter.mock.calls[0][0] as InternalAxiosRequestConfig,
        200,
        cartPayload([availableItem]),
      ),
    )

    expect(
      await screen.findByRole('link', { name: availableProduct.name }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(CART_PAGE_COPY.loadingLabel)).not.toBeInTheDocument()
  })

  it('shows an empty state with a link to the coffee catalog', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, cartPayload([])),
    )

    renderCart()

    expect(
      await screen.findByRole('heading', { name: CART_PAGE_COPY.emptyTitle }),
    ).toBeInTheDocument()
    expect(screen.getByText(CART_PAGE_COPY.emptyDescription)).toBeInTheDocument()

    const catalogLink = screen.getByRole('link', {
      name: CART_PAGE_COPY.goToCatalog,
    })
    expect(catalogLink).toHaveAttribute('href', '/coffee')
  })

  it('excludes out-of-stock items from the total and disables their quantity controls', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, cartPayload([availableItem, unavailableItem])),
    )

    renderCart()

    expect(
      await screen.findByRole('link', { name: availableProduct.name }),
    ).toBeInTheDocument()
    expect(screen.getByText(CART_COPY.outOfStock)).toBeInTheDocument()

    const unavailableRow = screen
      .getByRole('link', {
        name: unavailableProduct.name,
      })
      .closest('[data-testid="cart-page-item"]')
    expect(unavailableRow).not.toBeNull()

    const qtyGroup = within(unavailableRow as HTMLElement).getByRole('group', {
      name: CART_COPY.quantityLabel,
    })
    expect(
      within(qtyGroup).getByRole('button', { name: CART_COPY.decreaseQty }),
    ).toBeDisabled()
    expect(
      within(qtyGroup).getByRole('button', { name: CART_COPY.increaseQty }),
    ).toBeDisabled()

    const summary = screen.getByRole('complementary', {
      name: CART_PAGE_COPY.total,
    })
    expect(within(summary).getByText(hasMoneyText('1000.00'))).toBeInTheDocument()
    expect(within(summary).queryByText(hasMoneyText('1300.00'))).not.toBeInTheDocument()
  })

  it('links the checkout button to /checkout', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, cartPayload([availableItem])),
    )

    renderCart()

    const checkoutLink = await screen.findByRole('link', {
      name: CART_PAGE_COPY.checkout,
    })
    expect(checkoutLink).toHaveAttribute('href', '/checkout')
  })

  it('updates quantity optimistically and recalculates the line total', async () => {
    const user = userEvent.setup()
    let quantity = 2

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/api/cart/items/') && config.method === 'patch') {
        const body =
          typeof config.data === 'string'
            ? (JSON.parse(config.data) as { quantity?: number })
            : (config.data as { quantity?: number } | undefined)
        quantity = Number(body?.quantity ?? quantity)
        return jsonResponse(config, 200, {
          ...availableItem,
          quantity,
          line_total: (500 * quantity).toFixed(2),
        })
      }
      return jsonResponse(
        config,
        200,
        cartPayload([
          {
            ...availableItem,
            quantity,
            line_total: (500 * quantity).toFixed(2),
          },
        ]),
      )
    })

    renderCart()

    await screen.findByRole('link', { name: availableProduct.name })
    await user.click(screen.getByRole('button', { name: CART_COPY.increaseQty }))

    await waitFor(() => {
      const summary = screen.getByRole('complementary', {
        name: CART_PAGE_COPY.total,
      })
      expect(within(summary).getByText(hasMoneyText('1500.00'))).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('removes an item from the list without a full page reload', async () => {
    const user = userEvent.setup()
    let items = [availableItem, unavailableItem]

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/api/cart/items/') && config.method === 'delete') {
        items = items.filter((item) => !config.url?.includes(item.id))
        return jsonResponse(config, 204, undefined)
      }
      return jsonResponse(config, 200, cartPayload(items))
    })

    renderCart()

    await screen.findByRole('link', { name: availableProduct.name })
    const rows = screen.getAllByTestId('cart-page-item')
    const firstRow = rows[0]
    await user.click(
      within(firstRow).getByRole('button', { name: CART_PAGE_COPY.remove }),
    )

    await waitFor(() => {
      expect(
        screen.queryByRole('link', { name: availableProduct.name }),
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('link', { name: unavailableProduct.name }),
    ).toBeInTheDocument()
  })

  it('shows an error state with retry', async () => {
    const user = userEvent.setup()
    let shouldFail = true

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (shouldFail) {
        throw new AxiosError(
          'Server Error',
          AxiosError.ERR_BAD_RESPONSE,
          config,
          null,
          jsonResponse(config, 500, { detail: 'boom', code: 'server_error' }),
        )
      }
      return jsonResponse(config, 200, cartPayload([availableItem]))
    })

    renderCart()

    expect(
      await screen.findByRole('heading', { name: CART_PAGE_COPY.errorTitle }),
    ).toBeInTheDocument()

    shouldFail = false
    await user.click(screen.getByRole('button', { name: CART_PAGE_COPY.retry }))

    expect(
      await screen.findByRole('link', { name: availableProduct.name }),
    ).toBeInTheDocument()
  })
})

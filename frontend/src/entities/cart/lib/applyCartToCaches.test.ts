import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { Cart } from '../api/cartApi.typings'
import { cartKeys } from '../model/cartQueryOptions'
import {
  applyCartAddToCaches,
  applyCartRemoveToCaches,
  applyCartUpdateToCaches,
} from './applyCartToCaches'

const productId = '11111111-1111-1111-1111-111111111111'
const itemId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

const baseCart: Cart = {
  id: 'cart-1',
  items: [
    {
      id: itemId,
      product: {
        id: productId,
        name: 'Эфиопия Иргачеффе',
        slug: 'ethiopia-yirgacheffe',
        short_description: 'Цветочный аромат',
        price: '100.00',
        old_price: null,
        category: 'coffee',
        in_stock: true,
        image_url: null,
        is_favorite: false,
      },
      quantity: 2,
      line_total: '200.00',
    },
  ],
  total: '200.00',
  items_count: 1,
  cart_token: 'guest-token',
}

describe('applyCartToCaches', () => {
  it('increments quantity and line_total for an existing product', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(cartKeys.detail(), structuredClone(baseCart))

    applyCartAddToCaches(queryClient, productId, 3)

    const cart = queryClient.getQueryData(cartKeys.detail()) as Cart
    expect(cart.items[0]?.quantity).toBe(5)
    expect(cart.items[0]?.line_total).toBe('500.00')
    expect(cart.total).toBe('500.00')
    expect(cart.items_count).toBe(1)
  })

  it('bumps items_count when the product is not in the cached cart', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(cartKeys.detail(), structuredClone(baseCart))

    applyCartAddToCaches(queryClient, '22222222-2222-2222-2222-222222222222', 1)

    const cart = queryClient.getQueryData(cartKeys.detail()) as Cart
    expect(cart.items_count).toBe(2)
    expect(cart.items).toHaveLength(1)
  })

  it('updates quantity for a line by id', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(cartKeys.detail(), structuredClone(baseCart))

    applyCartUpdateToCaches(queryClient, itemId, 4)

    const cart = queryClient.getQueryData(cartKeys.detail()) as Cart
    expect(cart.items[0]?.quantity).toBe(4)
    expect(cart.items[0]?.line_total).toBe('400.00')
    expect(cart.total).toBe('400.00')
  })

  it('removes a line and decrements items_count', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(cartKeys.detail(), structuredClone(baseCart))

    applyCartRemoveToCaches(queryClient, itemId)

    const cart = queryClient.getQueryData(cartKeys.detail()) as Cart
    expect(cart.items).toHaveLength(0)
    expect(cart.items_count).toBe(0)
    expect(cart.total).toBe('0.00')
  })
})

import type { QueryClient } from '@tanstack/react-query'

import type { Cart, CartItem } from '../api/cartApi.typings'
import { cartKeys } from '../model/cartQueryOptions'

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return parsed
}

function formatMoneyAmount(value: number): string {
  return value.toFixed(2)
}

function sumLineTotals(items: CartItem[]): string {
  const total = items.reduce((sum, item) => sum + parseMoney(item.line_total), 0)
  return formatMoneyAmount(total)
}

function patchCart(queryClient: QueryClient, updater: (cart: Cart) => Cart): void {
  queryClient.setQueryData(cartKeys.detail(), (cached: unknown) => {
    if (cached == null || typeof cached !== 'object' || !('items' in cached)) {
      return cached
    }
    return updater(cached as Cart)
  })
}

/**
 * Вставляет или заменяет позицию по ответу API (после POST /cart/items/).
 * Нужно, чтобы на карточке сразу появился счётчик −/+.
 */
export function applyCartItemUpsertToCaches(
  queryClient: QueryClient,
  cartItem: CartItem,
): void {
  patchCart(queryClient, (cart) => {
    const existingIndex = cart.items.findIndex(
      (item) => item.id === cartItem.id || item.product.id === cartItem.product.id,
    )

    let items: CartItem[]
    if (existingIndex === -1) {
      items = [...cart.items, cartItem]
    } else {
      items = cart.items.map((item, index) =>
        index === existingIndex ? cartItem : item,
      )
    }

    return {
      ...cart,
      items,
      items_count: items.length,
      total: sumLineTotals(items),
    }
  })
}

/**
 * Оптимистично увеличивает quantity существующей позиции или `items_count`,
 * если товара ещё нет в кэше (полная строка придёт после ответа / invalidate).
 */
export function applyCartAddToCaches(
  queryClient: QueryClient,
  productId: string,
  quantity: number,
): void {
  patchCart(queryClient, (cart) => {
    const existingIndex = cart.items.findIndex((item) => item.product.id === productId)

    if (existingIndex === -1) {
      return {
        ...cart,
        items_count: cart.items_count + 1,
      }
    }

    const items = cart.items.map((item, index) => {
      if (index !== existingIndex) {
        return item
      }
      const nextQuantity = item.quantity + quantity
      const unitPrice = parseMoney(item.product.price)
      return {
        ...item,
        quantity: nextQuantity,
        line_total: formatMoneyAmount(unitPrice * nextQuantity),
      }
    })

    return {
      ...cart,
      items,
      total: sumLineTotals(items),
    }
  })
}

/**
 * Оптимистично задаёт quantity позиции по id.
 */
export function applyCartUpdateToCaches(
  queryClient: QueryClient,
  itemId: string,
  quantity: number,
): void {
  patchCart(queryClient, (cart) => {
    const items = cart.items.map((item) => {
      if (item.id !== itemId) {
        return item
      }
      const unitPrice = parseMoney(item.product.price)
      return {
        ...item,
        quantity,
        line_total: formatMoneyAmount(unitPrice * quantity),
      }
    })

    return {
      ...cart,
      items,
      total: sumLineTotals(items),
    }
  })
}

/**
 * Оптимистично удаляет позицию и обновляет items_count / total.
 */
export function applyCartRemoveToCaches(
  queryClient: QueryClient,
  itemId: string,
): void {
  patchCart(queryClient, (cart) => {
    const items = cart.items.filter((item) => item.id !== itemId)
    if (items.length === cart.items.length) {
      return cart
    }

    return {
      ...cart,
      items,
      items_count: Math.max(0, cart.items_count - 1),
      total: sumLineTotals(items),
    }
  })
}

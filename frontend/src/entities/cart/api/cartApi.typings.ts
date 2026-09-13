import type { ProductListItem } from '@entities/product'

/**
 * Позиция корзины (`CartItem` в OpenAPI).
 */
export interface CartItem {
  /** UUID позиции. */
  id: string
  /** Краткое описание товара. */
  product: ProductListItem
  /** Количество (≥ 1). */
  quantity: number
  /** Сумма позиции — decimal-строка в рублях. */
  line_total: string
}

/**
 * Полная корзина (`Cart` в OpenAPI).
 */
export interface Cart {
  /** UUID корзины. */
  id: string
  /** Позиции. */
  items: CartItem[]
  /** Итого — decimal-строка в рублях. */
  total: string
  /** Число различных товарных позиций. */
  items_count: number
  /** Гостевой токен; null у авторизованных. */
  cart_token: string | null
  /** Время последнего обновления (ISO), если есть. */
  updated_at?: string
}

/**
 * Тело POST /api/cart/items/.
 */
export interface CartItemCreate {
  /** UUID товара. */
  product_id: string
  /** Количество (≥ 1). */
  quantity: number
}

/**
 * Тело PATCH /api/cart/items/{id}/.
 */
export interface CartItemUpdate {
  /** Новое количество (≥ 1). */
  quantity: number
}

/**
 * Тело POST /api/cart/merge/.
 */
export interface CartMerge {
  /** Гостевой токен для слияния в корзину пользователя. */
  cart_token: string
}

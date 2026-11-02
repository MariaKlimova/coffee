import { guardRequest, http } from '@shared/api'

import type {
  Cart,
  CartItem,
  CartItemCreate,
  CartItemUpdate,
  CartMerge,
} from './cartApi.typings'

/**
 * Загружает текущую гостевую или пользовательскую корзину.
 */
export async function fetchCart(signal?: AbortSignal): Promise<Cart> {
  const { data } = await http.get<Cart>('/api/cart/', { signal })
  return data
}

/**
 * Добавляет товар в корзину (или увеличивает quantity, если позиция уже есть).
 */
export async function addItem(
  productId: string,
  quantity: number,
  assertActor?: () => void,
): Promise<CartItem> {
  const body: CartItemCreate = {
    product_id: productId,
    quantity,
  }
  const { data } = await http.post<CartItem>(
    '/api/cart/items/',
    body,
    guardRequest(assertActor),
  )
  return data
}

/**
 * Обновляет количество существующей позиции.
 */
export async function updateItem(
  itemId: string,
  quantity: number,
  assertActor?: () => void,
): Promise<CartItem> {
  const body: CartItemUpdate = { quantity }
  const { data } = await http.patch<CartItem>(
    `/api/cart/items/${itemId}/`,
    body,
    guardRequest(assertActor),
  )
  return data
}

/**
 * Удаляет позицию из корзины.
 */
export async function removeItem(
  itemId: string,
  assertActor?: () => void,
): Promise<void> {
  await http.delete(`/api/cart/items/${itemId}/`, guardRequest(assertActor))
}

/**
 * Сливает гостевую корзину в корзину авторизованного пользователя.
 */
export async function mergeCart(cartToken: string): Promise<Cart> {
  const body: CartMerge = { cart_token: cartToken }
  const { data } = await http.post<Cart>('/api/cart/merge/', body)
  return data
}

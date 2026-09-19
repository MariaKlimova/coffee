import { http } from '@shared/api'

import type {
  Order,
  OrderCreate,
  PaymentCreate,
  PaymentSession,
} from './orderApi.typings'

/**
 * Создаёт заказ из текущей корзины (JWT или гость с `X-Cart-Token`).
 */
export async function createOrder(payload: OrderCreate): Promise<Order> {
  const { data } = await http.post<Order>('/api/orders/', payload)
  return data
}

/**
 * Загружает заказ по UUID (`GET /api/orders/{id}/`).
 */
export async function getOrder(orderId: string): Promise<Order> {
  const { data } = await http.get<Order>(`/api/orders/${orderId}/`)
  return data
}

/**
 * Создаёт платёжную сессию ЮKassa и возвращает URL для редиректа.
 */
export async function createPayment(orderId: string): Promise<PaymentSession> {
  const body: PaymentCreate = { order_id: orderId }
  const { data } = await http.post<PaymentSession>('/api/payments/create/', body)
  return data
}

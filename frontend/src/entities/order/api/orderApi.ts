import type { Paginated } from '@entities/product'
import { http } from '@shared/api'

import type {
  Order,
  OrderCreate,
  OrderListItem,
  OrderListParams,
  PaymentCreate,
  PaymentSession,
} from './orderApi.typings'

function toQueryParams(params: OrderListParams): Record<string, string> {
  const query: Record<string, string> = {}
  if (params.page !== undefined && params.page > 1) {
    query.page = String(params.page)
  }
  if (params.page_size !== undefined) {
    query.page_size = String(params.page_size)
  }
  return query
}

/**
 * Создаёт заказ из текущей корзины (JWT или гость с `X-Cart-Token`).
 */
export async function createOrder(payload: OrderCreate): Promise<Order> {
  const { data } = await http.post<Order>('/api/orders/', payload)
  return data
}

/**
 * Список заказов текущего пользователя (`GET /api/orders/`).
 */
export async function listOrders(
  params: OrderListParams = {},
): Promise<Paginated<OrderListItem>> {
  const { data } = await http.get<Paginated<OrderListItem>>('/api/orders/', {
    params: toQueryParams(params),
  })
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

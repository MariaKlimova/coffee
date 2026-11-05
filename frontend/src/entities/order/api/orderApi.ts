import type { Paginated } from '@entities/product'
import { guardRequest, http } from '@shared/api'

import type {
  Order,
  OrderCreated,
  OrderCreate,
  OrderListItem,
  OrderListParams,
  PaymentCreate,
  PaymentSession,
} from './orderApi.typings'

/** Ограничение ожидания ссылки провайдера: заказ остаётся доступен для повтора. */
const PAYMENT_CREATE_TIMEOUT_MS = 30_000

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
export async function createOrder(
  payload: OrderCreate,
  assertActor?: () => void,
  cartToken?: string,
): Promise<OrderCreated> {
  const { data } = await http.post<OrderCreated>('/api/orders/', payload, {
    ...guardRequest(assertActor),
    headers: cartToken ? { 'X-Cart-Token': cartToken } : undefined,
  })
  assertActor?.()
  return data
}

/**
 * Список заказов текущего пользователя (`GET /api/orders/`).
 */
export async function listOrders(
  params: OrderListParams = {},
  assertActor?: () => void,
): Promise<Paginated<OrderListItem>> {
  const { data } = await http.get<Paginated<OrderListItem>>('/api/orders/', {
    ...guardRequest(assertActor),
    params: toQueryParams(params),
  })
  assertActor?.()
  return data
}

/**
 * Загружает заказ по UUID (`GET /api/orders/{id}/`).
 */
export async function getOrder(
  orderId: string,
  signal?: AbortSignal,
  assertActor?: () => void,
): Promise<Order> {
  const { data } = await http.get<Order>(`/api/orders/${orderId}/`, {
    ...guardRequest(assertActor),
    signal,
  })
  assertActor?.()
  return data
}

/**
 * Создаёт платёжную сессию ЮKassa и возвращает URL для редиректа.
 */
export async function createPayment(
  orderId: string,
  assertActor?: () => void,
): Promise<PaymentSession> {
  const body: PaymentCreate = { order_id: orderId }
  const { data } = await http.post<PaymentSession>('/api/payments/create/', body, {
    ...guardRequest(assertActor),
    timeout: PAYMENT_CREATE_TIMEOUT_MS,
  })
  assertActor?.()
  return data
}

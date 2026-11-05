/**
 * Тело POST /api/orders/ (`OrderCreate` в OpenAPI).
 */
export interface OrderCreate {
  /** UUID гостевого оформления для восстановления потерянного ответа. */
  checkout_request_id?: string
  /** Адрес доставки свободным текстом. */
  delivery_address: string
  /** Email гостя; обязателен без JWT. */
  guest_email?: string
  /** Телефон гостя; обязателен без JWT. */
  guest_phone?: string
}

/** Приватное подтверждение доступа выдаётся только при гостевом оформлении. */
export interface OrderCreated extends Order {
  /** Секрет действий; не сохраняется в кэше запросов. */
  guest_action_token?: string
  /** Монотонная версия гостевого секрета. */
  guest_action_version?: number
}

/** Безопасная приватная карточка без контактов и служебных причин. */
export type BuyerOrder = Omit<
  Order,
  'guest_email' | 'guest_phone' | 'stock_review_reason'
>

export type BuyerAction = 'cancel' | 'request_cancellation'

export interface CancellationRequest {
  /** UUID обращения. */
  id: string
  /** Причина, указанная покупателем. */
  reason: string
  /** Состояние рассмотрения обращения. */
  state: 'open' | 'accepted' | 'declined' | 'closed_unavailable'
  /** Дата обращения в ISO. */
  created_at: string
  /** Дата решения или null. */
  decided_at: string | null
  /** Ответ, предназначенный покупателю. */
  public_response: string
}

export interface BuyerActions {
  /** Актуальный безопасный снимок заказа. */
  order: BuyerOrder
  /** Разрешённые сервером действия. */
  allowed_actions: BuyerAction[]
  /** Только публичная история обращений. */
  cancellation_requests: CancellationRequest[]
}

export interface BuyerActionWrite {
  /** UUID неизменного подтверждённого действия. */
  request_id: string
  /** Статус при подтверждении. */
  expected_status: OrderStatus
  /** Причина; обязательна для обращения сотруднику. */
  reason: string
}

export interface BuyerActionResponse {
  /** Актуальный заказ. */
  order: BuyerOrder
  /** Актуальные права и обращения. */
  buyer_actions: BuyerActions
  /** Сервер подтвердил повтор ранее выполненного действия. */
  replayed: boolean
}

export interface GuestCheckoutRecovery {
  /** Восстановленный заказ без служебных данных. */
  order: BuyerOrder
  /** Новый гостевой секрет. */
  guest_action_token: string
  /** Версия секрета после восстановления. */
  guest_action_version: number
}

/**
 * Статус заказа (`Order.status` в OpenAPI).
 */
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'payment_review'

/**
 * Позиция заказа со снимком цены (`OrderItem` в OpenAPI).
 */
export interface OrderItem {
  /** UUID позиции заказа. */
  id: string
  /** UUID товара в каталоге; null, если товар удалён. */
  product_id: string | null
  /** Название товара на момент оформления. */
  product_name: string
  /** Цена за единицу — decimal-строка в рублях. */
  product_price: string
  /** Количество. */
  quantity: number
}

/**
 * Строка списка заказов (`OrderListItem` в OpenAPI).
 */
export interface OrderListItem {
  /** UUID заказа. */
  id: string
  /** Статус заказа. */
  status: OrderStatus
  /** Состояние количественного резерва; может отсутствовать у старого API. */
  reservation_state?: 'none' | 'active' | 'consumed' | 'released' | 'restored'
  /** Срок резерва (ISO) или null у старых заказов. */
  reservation_expires_at?: string | null
  /** Причина ручной проверки оплаченного заказа. */
  stock_review_reason?: string
  /** Итого — decimal-строка в рублях. */
  total: string
  /** Время создания (ISO). */
  created_at: string
}

/**
 * Параметры пагинации `GET /api/orders/`.
 */
export interface OrderListParams {
  /** Номер страницы (с 1). */
  page?: number
  /** Размер страницы (по умолчанию 20, макс. 100). */
  page_size?: number
}

/**
 * Созданный заказ (`Order` в OpenAPI).
 */
export interface Order extends OrderListItem {
  /** Адрес доставки. */
  delivery_address: string
  /** Email гостя, если заказ без аккаунта. */
  guest_email?: string | null
  /** Телефон гостя, если заказ без аккаунта. */
  guest_phone?: string | null
  /** Позиции со снимком цен. */
  items: OrderItem[]
  /** Время обновления (ISO). */
  updated_at: string
}

/**
 * Тело POST /api/payments/create/.
 */
export interface PaymentCreate {
  /** UUID заказа для оплаты. */
  order_id: string
}

/**
 * Сессия оплаты (`PaymentSession` в OpenAPI).
 */
export interface PaymentSession {
  /** UUID платежа. */
  id: string
  /** UUID заказа. */
  order_id: string
  /** Статус платежа у нас. */
  status: string
  /** Сумма — decimal-строка в рублях. */
  amount: string
  /** URL редиректа на страницу провайдера. */
  payment_url: string
  /** Время создания (ISO), если есть. */
  created_at?: string
}

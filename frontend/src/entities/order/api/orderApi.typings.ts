/**
 * Тело POST /api/orders/ (`OrderCreate` в OpenAPI).
 */
export interface OrderCreate {
  /** Адрес доставки свободным текстом. */
  delivery_address: string
  /** Email гостя; обязателен без JWT. */
  guest_email?: string
  /** Телефон гостя; обязателен без JWT. */
  guest_phone?: string
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
 * Созданный заказ (`Order` в OpenAPI).
 */
export interface Order {
  /** UUID заказа. */
  id: string
  /** Статус заказа. */
  status: OrderStatus
  /** Итого — decimal-строка в рублях. */
  total: string
  /** Время создания (ISO). */
  created_at: string
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

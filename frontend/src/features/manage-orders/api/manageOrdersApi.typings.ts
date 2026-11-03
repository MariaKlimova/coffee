import type { OrderItem, OrderListItem, OrderStatus } from '@entities/order'

export type ManagePaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled'

export interface ManageOrderListItem extends OrderListItem {
  /** Статус самой новой попытки оплаты; null, если попыток нет. */
  latest_payment_status: ManagePaymentStatus | null
  /** Доступный email гостя или текущего профиля. */
  customer_email: string | null
  /** Доступный телефон гостя или текущего профиля. */
  customer_phone: string | null
}

export interface ManagePayment {
  /** UUID попытки оплаты. */
  id: string
  /** Состояние попытки без данных провайдера. */
  status: ManagePaymentStatus
  /** Сумма в рублях, decimal-строка. */
  amount: string
  /** Дата создания в ISO. */
  created_at: string
  /** Дата обновления в ISO. */
  updated_at: string
}

export interface ManageOrder extends ManageOrderListItem {
  /** Сохранённый адрес доставки. */
  delivery_address: string
  /** Исторические позиции заказа. */
  items: OrderItem[]
  /** Безопасная история попыток оплаты, новые первыми. */
  payments: ManagePayment[]
  /** Дата обновления заказа в ISO. */
  updated_at: string
}

export interface ManageOrderFilters {
  /** Поиск по номеру или контакту. */
  search: string
  /** Статус или все статусы. */
  status: OrderStatus | ''
  /** Включительная начальная дата UTC. */
  date_from: string
  /** Включительная конечная дата UTC. */
  date_to: string
  /** Номер страницы с единицы. */
  page: number
}

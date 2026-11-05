import type {
  CancellationRequest,
  OrderItem,
  OrderListItem,
  OrderStatus,
} from '@entities/order'

export type ManagePaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled'

export interface ManageOrderListItem extends OrderListItem {
  /** Открытый запрос отмены; отсутствует в прежнем API. */
  open_cancellation_request?: CancellationRequest | null
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
  /** Обращения покупателей и приватные сведения о решении. */
  cancellation_requests?: ManageCancellationRequest[]
  /** Сохранённый адрес доставки. */
  delivery_address: string
  /** Исторические позиции заказа. */
  items: OrderItem[]
  /** Безопасная история попыток оплаты, новые первыми. */
  payments: ManagePayment[]
  /** Дата обновления заказа в ISO. */
  updated_at: string
  /** Разрешённые сервером действия сотрудника. */
  allowed_transitions: AllowedOrderTransition[]
  /** Реальные события обработки в хронологическом порядке. */
  status_history: OrderStatusHistoryEntry[]
}

export interface AllowedOrderTransition {
  /** Статус после действия. */
  to_status: OrderStatus
  /** Изменение количества товаров при выполнении. */
  inventory_effect: 'release_reservation' | 'restore_stock' | 'none'
  /** Причина отсутствия учётного изменения у старого заказа. */
  inventory_reason: 'legacy_uncounted' | null
}

export interface OrderStatusHistoryEntry {
  /** UUID события. */
  id: string
  /** Статус до изменения. */
  from_status: OrderStatus
  /** Статус после изменения. */
  to_status: OrderStatus
  /** Время события в UTC. */
  created_at: string
  /** Источник изменения. */
  source: 'staff' | 'buyer' | 'payment' | 'reservation_expiry'
  /** Снимок подписи сотрудника; отсутствует у автоматического события. */
  actor: {
    /** UUID сотрудника; null после удаления аккаунта. */
    id: string | null
    /** Сохранённая подпись сотрудника без контактов. */
    label: string
  } | null
  /** Обычный текст комментария. */
  comment: string
}

export interface ManageCancellationRequest extends CancellationRequest {
  /** Комментарий только для сотрудников. */
  private_comment: string
  /** Сотрудник, принявший решение, без контактов. */
  decided_by: {
    /** UUID сотрудника или null после удаления. */
    id: string | null
    /** Снимок подписи сотрудника. */
    label: string
  } | null
}

export interface CancellationDecisionWrite {
  /** UUID подтверждённого решения; отличается от UUID обращения в URL. */
  request_id: string
  /** Решение сотрудника. */
  decision: 'accept' | 'decline'
  /** Статус заказа при подтверждении. */
  expected_status: OrderStatus
  /** Обязательный публичный ответ покупателю. */
  public_response: string
  /** Необязательный комментарий только для сотрудников. */
  private_comment: string
}

export interface OrderTransitionWrite {
  /** Статус, показанный сотруднику при подтверждении. */
  expected_status: OrderStatus
  /** Подтверждённый целевой статус. */
  to_status: OrderStatus
  /** UUID одного намерения, сохраняемый при сетевом повторе. */
  request_id: string
  /** Комментарий без пробелов по краям, до 500 символов. */
  comment: string
}

export interface OrderTransitionResponse {
  /** Текущий заказ, в том числе при повторе прежнего действия. */
  order: ManageOrder
  /** Действие уже было выполнено с этим UUID. */
  replayed: boolean
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

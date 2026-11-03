import { MANAGE_ORDERS_COPY } from '@shared/lib/copy'

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

/** Список и фильтры используют один календарь UTC. */
export function formatManageOrderDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : `${dateFormatter.format(date)} UTC`
}

export function paymentLabel(status: string | null) {
  switch (status) {
    case null:
      return MANAGE_ORDERS_COPY.noPayment
    case 'pending':
      return MANAGE_ORDERS_COPY.paymentPending
    case 'succeeded':
      return MANAGE_ORDERS_COPY.paymentSucceeded
    case 'failed':
      return MANAGE_ORDERS_COPY.paymentFailed
    case 'canceled':
      return MANAGE_ORDERS_COPY.paymentCanceled
    default:
      return MANAGE_ORDERS_COPY.paymentUnknown
  }
}

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** В управлении сохраняем копейки из исторической decimal-суммы. */
export function formatManageMoney(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? moneyFormatter.format(amount) : value
}

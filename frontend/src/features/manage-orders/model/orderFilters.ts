import type { OrderStatus } from '@entities/order'
import { MANAGE_ORDERS_COPY } from '@shared/lib/copy'

import type { ManageOrderFilters } from '../api/manageOrdersApi.typings'

export const MANAGE_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'payment_review',
]

function validDate(value: string) {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Проверяет внешние URL до запроса, сохраняя фильтры при переходах назад. */
export function readOrderFilters(params: URLSearchParams) {
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? 1)
  const filters: ManageOrderFilters = {
    search: params.get('search') ?? '',
    status: status as OrderStatus | '',
    date_from: params.get('date_from') ?? '',
    date_to: params.get('date_to') ?? '',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
  let error = ''
  if (filters.search.length > 255) error = MANAGE_ORDERS_COPY.invalidSearch
  else if (status && !MANAGE_ORDER_STATUSES.includes(status as OrderStatus))
    error = MANAGE_ORDERS_COPY.invalidStatus
  else if (
    !validDate(filters.date_from) ||
    !validDate(filters.date_to) ||
    (filters.date_from && filters.date_to && filters.date_from > filters.date_to)
  )
    error = MANAGE_ORDERS_COPY.invalidFilters
  return { filters, error }
}

export function orderFilterParams(filters: ManageOrderFilters) {
  return new URLSearchParams(
    Object.entries(filters)
      .filter(([key, value]) => value !== '' && !(key === 'page' && value === 1))
      .map(([key, value]) => [key, String(value)]),
  )
}

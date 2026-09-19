import { ORDER_STATUS_COPY } from '@shared/lib/copy'
import type { BadgeVariant } from '@shared/ui/Badge'

import type { OrderStatus } from '../api/orderApi.typings'

const ORDER_STATUS_BADGE_VARIANT: Record<OrderStatus, BadgeVariant> = {
  pending: 'neutral',
  processing: 'neutral',
  paid: 'success',
  shipped: 'success',
  delivered: 'success',
  cancelled: 'neutral',
}

/**
 * Подпись статуса на русском из copy; неизвестный — fallback.
 */
export function getOrderStatusLabel(status: OrderStatus | string): string {
  if (status in ORDER_STATUS_COPY && status !== 'unknown') {
    return ORDER_STATUS_COPY[status as OrderStatus]
  }
  return ORDER_STATUS_COPY.unknown
}

/**
 * Variant Badge для статуса; по умолчанию neutral.
 */
export function getOrderStatusBadgeVariant(status: OrderStatus | string): BadgeVariant {
  if (status in ORDER_STATUS_BADGE_VARIANT) {
    return ORDER_STATUS_BADGE_VARIANT[status as OrderStatus]
  }
  return 'neutral'
}

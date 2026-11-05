import { MANAGE_ORDERS_COPY as copy } from '@shared/lib/copy'

import type { AllowedOrderTransition } from '../api/manageOrdersApi.typings'

/** Объясняет ровно тот учётный эффект, который сообщил сервер. */
export function inventoryHint(action: AllowedOrderTransition) {
  if (action.inventory_reason === 'legacy_uncounted') return copy.legacyStock
  if (action.inventory_effect === 'release_reservation') return copy.releaseReservation
  if (action.inventory_effect === 'restore_stock') return copy.restoreStock
  return copy.unchangedStock
}

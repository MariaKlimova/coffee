import { APP_ROUTES } from '@shared/config/routes'

import { readPaymentRecoveryOrderId } from './pendingOrderId'

/** Query хранит только id заказа, без контактов и платёжных данных. */
export function paymentRecoverySearch(orderId: string): string {
  return new URLSearchParams({ order_id: orderId, payment: 'recovery' }).toString()
}

/** Адрес существующего экрана заказа после прерванного перехода к оплате. */
export function paymentRecoveryPath(orderId: string): string {
  return `${APP_ROUTES.checkoutResult}?${paymentRecoverySearch(orderId)}`
}

/** Восстанавливает только незавершённый переход к оплате. */
export function resolvePaymentRecoveryOrderId(params: URLSearchParams): string | null {
  const queryId = params.get('order_id')?.trim()
  if (queryId) {
    if (
      params.get('payment') === 'recovery' ||
      readPaymentRecoveryOrderId() === queryId
    ) {
      return queryId
    }
    return null
  }
  return readPaymentRecoveryOrderId()
}

/** Ключ sessionStorage для созданного заказа до перехода к провайдеру. */
export const PENDING_ORDER_ID_KEY = 'coffee:pendingOrderId'

/** Заказ, для которого переход к провайдеру ещё не подтверждён. */
const PAYMENT_RECOVERY_ORDER_ID_KEY = 'coffee:paymentRecoveryOrderId'

/** Сохраняет созданный заказ до запроса платёжной сессии. */
export function writePaymentRecoveryOrderId(orderId: string): void {
  writePendingOrderId(orderId)
  try {
    sessionStorage.setItem(PAYMENT_RECOVERY_ORDER_ID_KEY, orderId)
  } catch {
    // При недоступном storage id остаётся в query-параметре чекаута.
  }
}

/** Читает заказ, для которого требуется восстановить переход к оплате. */
export function readPaymentRecoveryOrderId(): string | null {
  try {
    const orderId = sessionStorage.getItem(PAYMENT_RECOVERY_ORDER_ID_KEY)
    return orderId === readPendingOrderId() ? orderId : null
  } catch {
    return null
  }
}

/** Отмечает успешное получение ссылки провайдера, сохраняя id для return flow. */
export function clearPaymentRecoveryOrderId(): void {
  try {
    sessionStorage.removeItem(PAYMENT_RECOVERY_ORDER_ID_KEY)
  } catch {
    // Возврат с оплаты также содержит order_id в URL.
  }
}

/**
 * Сохраняет id созданного заказа для восстановления и возврата с оплаты.
 */
export function writePendingOrderId(orderId: string): void {
  try {
    sessionStorage.setItem(PENDING_ORDER_ID_KEY, orderId)
  } catch {
    // private mode / quota — query-параметр return_url остаётся основным каналом
  }
}

/**
 * Читает id заказа, сохранённый перед оплатой.
 */
export function readPendingOrderId(): string | null {
  try {
    return sessionStorage.getItem(PENDING_ORDER_ID_KEY)
  } catch {
    return null
  }
}

/**
 * Удаляет сохранённый id после успешного исхода или явной очистки.
 */
export function clearPendingOrderId(): void {
  clearPaymentRecoveryOrderId()
  try {
    sessionStorage.removeItem(PENDING_ORDER_ID_KEY)
  } catch {
    // ignore
  }
}

/**
 * Резолвит order_id: сначала `?order_id=` из return_url, иначе sessionStorage.
 */
export function resolveOrderIdFromReturn(searchParams: URLSearchParams): string | null {
  const fromQuery = searchParams.get('order_id')?.trim()
  if (fromQuery) {
    return fromQuery
  }
  return readPendingOrderId()
}

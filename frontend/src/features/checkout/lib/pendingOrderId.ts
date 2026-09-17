/** Ключ sessionStorage для order_id после редиректа на ЮKassa. */
export const PENDING_ORDER_ID_KEY = 'coffee:pendingOrderId'

/**
 * Сохраняет id заказа перед уходом на страницу оплаты провайдера.
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
  try {
    sessionStorage.removeItem(PENDING_ORDER_ID_KEY)
  } catch {
    // ignore
  }
}

/**
 * Резолвит order_id: сначала `?order_id=` из return_url, иначе sessionStorage.
 */
export function resolveOrderIdFromReturn(
  searchParams: URLSearchParams,
): string | null {
  const fromQuery = searchParams.get('order_id')?.trim()
  if (fromQuery) {
    return fromQuery
  }
  return readPendingOrderId()
}

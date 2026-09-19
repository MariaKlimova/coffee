import { afterEach, describe, expect, it } from 'vitest'

import {
  clearPendingOrderId,
  PENDING_ORDER_ID_KEY,
  readPendingOrderId,
  resolveOrderIdFromReturn,
  writePendingOrderId,
} from './pendingOrderId'

describe('pendingOrderId', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('writes and reads order id from sessionStorage', () => {
    writePendingOrderId('order-1')
    expect(sessionStorage.getItem(PENDING_ORDER_ID_KEY)).toBe('order-1')
    expect(readPendingOrderId()).toBe('order-1')
  })

  it('clears stored order id', () => {
    writePendingOrderId('order-1')
    clearPendingOrderId()
    expect(readPendingOrderId()).toBeNull()
  })

  it('prefers query order_id over sessionStorage', () => {
    writePendingOrderId('from-storage')
    const params = new URLSearchParams('order_id=from-query')
    expect(resolveOrderIdFromReturn(params)).toBe('from-query')
  })

  it('falls back to sessionStorage when query is empty', () => {
    writePendingOrderId('from-storage')
    expect(resolveOrderIdFromReturn(new URLSearchParams())).toBe('from-storage')
  })

  it('returns null when neither source has an id', () => {
    expect(resolveOrderIdFromReturn(new URLSearchParams())).toBeNull()
  })
})

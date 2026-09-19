import { describe, expect, it } from 'vitest'

import { ORDER_STATUS_COPY } from '@shared/lib/copy'

import { getOrderStatusBadgeVariant, getOrderStatusLabel } from './orderStatus'

describe('orderStatus', () => {
  it('maps every known status to a Russian label from copy', () => {
    expect(getOrderStatusLabel('pending')).toBe(ORDER_STATUS_COPY.pending)
    expect(getOrderStatusLabel('paid')).toBe(ORDER_STATUS_COPY.paid)
    expect(getOrderStatusLabel('processing')).toBe(ORDER_STATUS_COPY.processing)
    expect(getOrderStatusLabel('shipped')).toBe(ORDER_STATUS_COPY.shipped)
    expect(getOrderStatusLabel('delivered')).toBe(ORDER_STATUS_COPY.delivered)
    expect(getOrderStatusLabel('cancelled')).toBe(ORDER_STATUS_COPY.cancelled)
  })

  it('maps badge variants by status tone', () => {
    expect(getOrderStatusBadgeVariant('pending')).toBe('neutral')
    expect(getOrderStatusBadgeVariant('processing')).toBe('neutral')
    expect(getOrderStatusBadgeVariant('cancelled')).toBe('neutral')
    expect(getOrderStatusBadgeVariant('paid')).toBe('success')
    expect(getOrderStatusBadgeVariant('shipped')).toBe('success')
    expect(getOrderStatusBadgeVariant('delivered')).toBe('success')
  })

  it('falls back to unknown copy for unknown status', () => {
    expect(getOrderStatusLabel('mystery')).toBe(ORDER_STATUS_COPY.unknown)
    expect(getOrderStatusBadgeVariant('mystery')).toBe('neutral')
  })
})

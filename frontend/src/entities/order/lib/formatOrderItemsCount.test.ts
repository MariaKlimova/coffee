import { describe, expect, it } from 'vitest'

import { formatOrderItemsCount } from './formatOrderItemsCount'

describe('formatOrderItemsCount', () => {
  it('uses Russian plural forms', () => {
    expect(formatOrderItemsCount(1)).toBe('1 позиция')
    expect(formatOrderItemsCount(2)).toBe('2 позиции')
    expect(formatOrderItemsCount(5)).toBe('5 позиций')
    expect(formatOrderItemsCount(11)).toBe('11 позиций')
    expect(formatOrderItemsCount(21)).toBe('21 позиция')
    expect(formatOrderItemsCount(22)).toBe('22 позиции')
  })
})

import { describe, expect, it } from 'vitest'

import { formatMoney } from './formatMoney'

describe('formatMoney', () => {
  it('formats a decimal money string with a non-breaking space before ₽', () => {
    expect(formatMoney('1290.00')).toBe('1\u00A0290\u00A0₽')
  })

  it('formats whole numbers without fraction digits', () => {
    expect(formatMoney('990')).toBe('990\u00A0₽')
  })

  it('returns the original value when the input is not a finite number', () => {
    expect(formatMoney('not-a-price')).toBe('not-a-price')
  })
})

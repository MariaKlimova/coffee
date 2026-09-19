import { describe, expect, it } from 'vitest'

import { formatOrderDate } from './formatOrderDate'

describe('formatOrderDate', () => {
  it('formats a valid ISO date in ru-RU', () => {
    expect(formatOrderDate('2026-09-19T12:00:00Z')).toMatch(/2026/)
  })

  it('returns the input when the date is invalid', () => {
    expect(formatOrderDate('not-a-date')).toBe('not-a-date')
  })
})

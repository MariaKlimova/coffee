import { describe, expect, it } from 'vitest'

import { parsePageNumber } from './parsePageNumber'

describe('parsePageNumber', () => {
  it('returns 1 for missing or invalid values', () => {
    expect(parsePageNumber(null)).toBe(1)
    expect(parsePageNumber(undefined)).toBe(1)
    expect(parsePageNumber('')).toBe(1)
    expect(parsePageNumber('0')).toBe(1)
    expect(parsePageNumber('-2')).toBe(1)
    expect(parsePageNumber('abc')).toBe(1)
  })

  it('parses a positive page number', () => {
    expect(parsePageNumber('2')).toBe(2)
    expect(parsePageNumber('15')).toBe(15)
  })
})

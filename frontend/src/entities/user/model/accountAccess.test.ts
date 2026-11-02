import { describe, expect, it } from 'vitest'
import {
  selectAccountMode,
  selectCanManage,
  selectCanShop,
  selectCanUseFavorites,
} from './accountAccess'

const buyer = { id: 'buyer', email: 'buyer@example.invalid' }
const owner = { ...buyer, is_staff: true }

describe('account access policy', () => {
  it.each(['idle', 'restoring'] as const)(
    'exposes no actions while %s even with a retained user',
    (status) => {
      const state = { status, user: owner }
      expect(selectAccountMode(state)).toBe('pending')
      expect(selectCanShop(state)).toBe(false)
      expect(selectCanManage(state)).toBe(false)
      expect(selectCanUseFavorites(state)).toBe(false)
    },
  )
  it('keeps shopping for guests and buyers, and favorites only for buyers', () => {
    expect(selectCanShop({ status: 'guest', user: null })).toBe(true)
    expect(selectCanUseFavorites({ status: 'guest', user: null })).toBe(false)
    expect(selectCanShop({ status: 'authenticated', user: buyer })).toBe(true)
    expect(selectCanUseFavorites({ status: 'authenticated', user: buyer })).toBe(true)
  })
  it('gives staff owner navigation without shopping', () => {
    const state = { status: 'authenticated' as const, user: owner }
    expect(selectCanManage(state)).toBe(true)
    expect(selectCanShop(state)).toBe(false)
    expect(selectCanUseFavorites(state)).toBe(false)
  })
})

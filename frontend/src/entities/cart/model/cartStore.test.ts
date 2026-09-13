import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resetCartBridge } from '@shared/api'

import { CART_TOKEN_KEY, clearCartTokenStorage } from './cartStorage'
import { bindCartBridge, useCartStore } from './cartStore'

describe('cartStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useCartStore.setState({ cartToken: null })
    bindCartBridge()
  })

  afterEach(() => {
    clearCartTokenStorage()
    resetCartBridge()
  })

  it('persists cart token to localStorage', () => {
    useCartStore.getState().setCartToken('guest-uuid')

    expect(useCartStore.getState().cartToken).toBe('guest-uuid')
    expect(localStorage.getItem(CART_TOKEN_KEY)).toBe('guest-uuid')
  })

  it('clears cart token from memory and storage', () => {
    useCartStore.getState().setCartToken('guest-uuid')
    useCartStore.getState().clearCartToken()

    expect(useCartStore.getState().cartToken).toBeNull()
    expect(localStorage.getItem(CART_TOKEN_KEY)).toBeNull()
  })
})

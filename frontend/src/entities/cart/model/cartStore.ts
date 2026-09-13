import { create } from 'zustand'

import { setCartBridge } from '@shared/api'

import {
  clearCartTokenStorage,
  readCartToken,
  writeCartToken,
} from './cartStorage'
import type { CartStoreState } from './cartStore.typings'

/**
 * Привязывает HTTP cart bridge к этому стору.
 * Вызывать один раз при bootstrap приложения (и в тестах после `resetCartBridge()`).
 */
export function bindCartBridge(): void {
  setCartBridge({
    getCartToken: () => useCartStore.getState().cartToken,
    setCartToken: (cartToken) => {
      useCartStore.getState().setCartToken(cartToken)
    },
  })
}

export const useCartStore = create<CartStoreState>((set) => ({
  cartToken: readCartToken(),

  setCartToken: (cartToken: string) => {
    writeCartToken(cartToken)
    set({ cartToken })
  },

  clearCartToken: () => {
    clearCartTokenStorage()
    set({ cartToken: null })
  },
}))

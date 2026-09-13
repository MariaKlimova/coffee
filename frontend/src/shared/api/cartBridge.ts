import type { CartBridge } from './cartBridge.typings'

const emptyBridge: CartBridge = {
  getCartToken: () => null,
  setCartToken: () => undefined,
}

let bridge: CartBridge = emptyBridge

/**
 * Заменяет активный cart bridge (вызывается из entities/cart).
 */
export function setCartBridge(next: CartBridge): void {
  bridge = next
}

/**
 * Текущий зарегистрированный cart bridge.
 */
export function getCartBridge(): CartBridge {
  return bridge
}

/**
 * Возвращает no-op bridge (удобно в тестах).
 */
export function resetCartBridge(): void {
  bridge = emptyBridge
}

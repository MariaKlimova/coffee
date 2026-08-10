import type { AuthBridge } from './authBridge.typings'

const guestBridge: AuthBridge = {
  getAccessToken: () => null,
  getRefreshToken: () => null,
  onTokenRefreshed: () => undefined,
  onSessionExpired: () => undefined,
}

let bridge: AuthBridge = guestBridge

/**
 * Replaces the active auth bridge (called from entities/user and app setup).
 */
export function setAuthBridge(next: AuthBridge): void {
  bridge = next
}

/**
 * Returns the currently registered auth bridge.
 */
export function getAuthBridge(): AuthBridge {
  return bridge
}

/**
 * Restores the no-op guest bridge (useful in tests).
 */
export function resetAuthBridge(): void {
  bridge = guestBridge
}

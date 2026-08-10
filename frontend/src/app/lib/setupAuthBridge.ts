import { router } from '@app/router'
import { shouldRedirectOnSessionExpired } from '@app/lib/sessionExpiredRedirect'
import { bindAuthBridge, useAuthStore } from '@entities/user'
import { getAuthBridge, setAuthBridge } from '@shared/api'

/**
 * Single bootstrap for the HTTP auth bridge: store binding + optional login redirect.
 * Must run once before the app renders.
 */
export function setupAuthBridge(): void {
  bindAuthBridge()

  const current = getAuthBridge()
  setAuthBridge({
    getAccessToken: current.getAccessToken,
    getRefreshToken: current.getRefreshToken,
    onTokenRefreshed: current.onTokenRefreshed,
    onSessionExpired: () => {
      const status = useAuthStore.getState().status
      current.onSessionExpired()
      if (shouldRedirectOnSessionExpired(status)) {
        void router.navigate('/login')
      }
    },
  })
}

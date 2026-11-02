/**
 * Dependency bridge between the HTTP client (shared) and the auth store (entities).
 * Registered by the entities/app layers so shared never imports upwards.
 */
export interface AuthBridge {
  /** Access token for the Authorization header, or null for guests. */
  getAccessToken: () => string | null
  /** Refresh token used to renew the access token, or null. */
  getRefreshToken: () => string | null
  /**
   * Непрозрачный id жизни сессии, не userId/JWT. Стабилен при refresh/ротации,
   * меняется при каждом login/logout и смене сессии. Без getter действует
   * консервативная проверка исходного refresh token.
   */
  getSessionIdentity?: () => string | number
  /** Stores a freshly issued access token. */
  onTokenRefreshed: (accessToken: string) => void
  /**
   * Clears the local session after refresh failure.
   * The app layer may additionally redirect to /login for mid-session expiry.
   */
  onSessionExpired: () => void
}

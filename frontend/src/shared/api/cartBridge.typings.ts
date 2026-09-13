/**
 * Мост между HTTP-клиентом (shared) и стором гостевого токена (entities).
 * Регистрируется слоем entities, чтобы shared не импортировал «вверх».
 */
export interface CartBridge {
  /** Гостевой токен для заголовка `X-Cart-Token` или null. */
  getCartToken: () => string | null
  /** Сохраняет токен, который вернул API. */
  setCartToken: (cartToken: string) => void
}

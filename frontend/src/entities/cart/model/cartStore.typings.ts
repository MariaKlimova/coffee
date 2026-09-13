/**
 * Zustand-стор только для гостевого токена; тело корзины — в React Query.
 */
export interface CartStoreState {
  /** Гостевой токен из localStorage / API или null. */
  cartToken: string | null
  /** Сохраняет гостевой токен в память и storage. */
  setCartToken: (cartToken: string) => void
  /** Очищает гостевой токен в памяти и storage. */
  clearCartToken: () => void
}

import { queryOptions } from '@tanstack/react-query'

import { fetchCart } from '../api/cartApi'

export const cartKeys = {
  all: ['cart'] as const,
  detail: () => [...cartKeys.all, 'detail'] as const,
}

/**
 * Текущая корзина (гость или пользователь) — для счётчика в Header и UI корзины.
 */
export function cartQueryOptions() {
  return queryOptions({
    queryKey: cartKeys.detail(),
    queryFn: fetchCart,
  })
}

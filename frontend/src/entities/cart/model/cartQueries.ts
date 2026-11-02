import { useQuery } from '@tanstack/react-query'

import { selectCanShop, useAuthStore } from '@entities/user'

import { cartQueryOptions } from './cartQueryOptions'

/**
 * Текущая корзина для гостя и авторизованного пользователя.
 * Отключена при idle/restoring, чтобы не создать гостевую корзину посреди логина.
 */
export function useCart() {
  const canShop = useAuthStore(selectCanShop)

  return useQuery({
    ...cartQueryOptions(),
    enabled: canShop,
    staleTime: 30_000,
  })
}

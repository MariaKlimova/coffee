import { useQuery } from '@tanstack/react-query'

import { useAuthStore } from '@entities/user'

import { cartQueryOptions } from './cartQueryOptions'

/**
 * Текущая корзина для гостя и авторизованного пользователя.
 * Отключена при idle/restoring, чтобы не создать гостевую корзину посреди логина.
 */
export function useCart() {
  const status = useAuthStore((state) => state.status)

  return useQuery({
    ...cartQueryOptions(),
    enabled: status === 'guest' || status === 'authenticated',
    staleTime: 30_000,
  })
}

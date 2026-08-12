import { useQuery } from '@tanstack/react-query'

import { useAuthStore } from '@entities/user'

import { favoritesCountQueryOptions } from './favoriteQueryOptions'

/**
 * Total number of favorites for the authenticated user.
 * Disabled for guests — returns undefined / no request.
 */
export function useFavoritesCount() {
  const status = useAuthStore((state) => state.status)

  return useQuery({
    ...favoritesCountQueryOptions(),
    enabled: status === 'authenticated',
    staleTime: 60_000,
  })
}

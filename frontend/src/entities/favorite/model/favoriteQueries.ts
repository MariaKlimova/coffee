import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { selectCanUseFavorites, useAuthStore } from '@entities/user'

import type { FavoriteListParams } from '../api/favoriteApi.typings'
import {
  favoritesCountQueryOptions,
  favoritesQueryOptions,
} from './favoriteQueryOptions'

/**
 * Total number of favorites for the authenticated user.
 * Disabled for guests — returns undefined / no request.
 */
export function useFavoritesCount() {
  const canUseFavorites = useAuthStore(selectCanUseFavorites)

  return useQuery({
    ...favoritesCountQueryOptions(),
    enabled: canUseFavorites,
    staleTime: 60_000,
  })
}

/**
 * Paginated favorites list for the authenticated user.
 * Keeps previous page data while the next page loads.
 */
export function useFavorites(params: FavoriteListParams = {}) {
  const canUseFavorites = useAuthStore(selectCanUseFavorites)

  return useQuery({
    ...favoritesQueryOptions(params),
    enabled: canUseFavorites,
    placeholderData: keepPreviousData,
  })
}

import { queryOptions } from '@tanstack/react-query'

import { fetchFavorites } from '../api/favoriteApi'
import type { FavoriteListParams } from '../api/favoriteApi.typings'

export const favoriteKeys = {
  all: ['favorites'] as const,
  list: (params: FavoriteListParams) => [...favoriteKeys.all, 'list', params] as const,
  count: () => [...favoriteKeys.all, 'count'] as const,
}

/**
 * Paginated favorites list — shared by the future favorites page and count prefetch.
 */
export function favoritesQueryOptions(params: FavoriteListParams = {}) {
  return queryOptions({
    queryKey: favoriteKeys.list(params),
    queryFn: () => fetchFavorites(params),
  })
}

/**
 * Total favorites count via a minimal page_size=1 list request.
 */
export function favoritesCountQueryOptions() {
  return queryOptions({
    queryKey: favoriteKeys.count(),
    queryFn: async () => {
      const data = await fetchFavorites({ page: 1, page_size: 1 })
      return data.count
    },
  })
}

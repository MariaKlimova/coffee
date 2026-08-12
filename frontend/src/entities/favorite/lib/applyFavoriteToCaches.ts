import type { QueryClient } from '@tanstack/react-query'

import {
  productKeys,
  type Paginated,
  type Product,
  type ProductListItem,
} from '@entities/product'

import { favoriteKeys } from '../model/favoriteQueryOptions'

function patchProductFavorite<T extends { id: string; is_favorite: boolean }>(
  item: T,
  productId: string,
  isFavorite: boolean,
): T {
  if (item.id !== productId) {
    return item
  }
  return { ...item, is_favorite: isFavorite }
}

/**
 * Optimistically patches every product cache entry that carries `is_favorite`
 * (list pages, related arrays, detail) and adjusts the favorites count by ±1.
 */
export function applyFavoriteToCaches(
  queryClient: QueryClient,
  productId: string,
  isFavorite: boolean,
): void {
  queryClient.setQueriesData({ queryKey: productKeys.all }, (cached: unknown) => {
    if (cached == null || typeof cached === 'number') {
      return cached
    }

    if (Array.isArray(cached)) {
      return (cached as ProductListItem[]).map((item) =>
        patchProductFavorite(item, productId, isFavorite),
      )
    }

    if (typeof cached === 'object' && 'results' in cached) {
      const page = cached as Paginated<ProductListItem>
      return {
        ...page,
        results: page.results.map((item) =>
          patchProductFavorite(item, productId, isFavorite),
        ),
      }
    }

    if (typeof cached === 'object' && 'id' in cached && 'is_favorite' in cached) {
      return patchProductFavorite(cached as Product, productId, isFavorite)
    }

    return cached
  })

  queryClient.setQueryData(favoriteKeys.count(), (count: unknown) => {
    if (typeof count !== 'number') {
      return count
    }
    return Math.max(0, count + (isFavorite ? 1 : -1))
  })
}

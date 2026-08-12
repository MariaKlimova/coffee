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
 * Optimistically patches product caches (`is_favorite`), favorite list pages
 * (remove on unfavorite), and the header count (±1).
 *
 * Favorite list inserts on re-favorite are left to invalidation — page position
 * is unknown. `didChange` is raised from product or favorites-list patches so
 * the header count still updates when the user opened `/favorites` directly.
 */
export function applyFavoriteToCaches(
  queryClient: QueryClient,
  productId: string,
  isFavorite: boolean,
): void {
  let didChange = false

  queryClient.setQueriesData({ queryKey: productKeys.all }, (cached: unknown) => {
    if (cached == null || typeof cached === 'number') {
      return cached
    }

    if (Array.isArray(cached)) {
      return (cached as ProductListItem[]).map((item) => {
        if (item.id === productId && item.is_favorite !== isFavorite) {
          didChange = true
        }
        return patchProductFavorite(item, productId, isFavorite)
      })
    }

    if (typeof cached === 'object' && 'results' in cached) {
      const page = cached as Paginated<ProductListItem>
      return {
        ...page,
        results: page.results.map((item) => {
          if (item.id === productId && item.is_favorite !== isFavorite) {
            didChange = true
          }
          return patchProductFavorite(item, productId, isFavorite)
        }),
      }
    }

    if (typeof cached === 'object' && 'id' in cached && 'is_favorite' in cached) {
      const product = cached as Product
      if (product.id === productId && product.is_favorite !== isFavorite) {
        didChange = true
      }
      return patchProductFavorite(product, productId, isFavorite)
    }

    return cached
  })

  queryClient.setQueriesData({ queryKey: favoriteKeys.lists() }, (cached: unknown) => {
    if (cached == null || typeof cached !== 'object' || !('results' in cached)) {
      return cached
    }

    const page = cached as Paginated<ProductListItem>

    if (isFavorite) {
      return cached
    }

    const nextResults = page.results.filter((item) => item.id !== productId)
    if (nextResults.length === page.results.length) {
      return cached
    }

    didChange = true
    return {
      ...page,
      results: nextResults,
      count: Math.max(0, page.count - 1),
    }
  })

  if (!didChange) {
    return
  }

  queryClient.setQueryData(favoriteKeys.count(), (count: unknown) => {
    if (typeof count !== 'number') {
      return count
    }
    return Math.max(0, count + (isFavorite ? 1 : -1))
  })
}

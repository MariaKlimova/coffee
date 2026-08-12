import type { Paginated, ProductListItem } from '@entities/product'
import { http } from '@shared/api'

import type { Favorite, FavoriteListParams } from './favoriteApi.typings'

function toQueryParams(params: FavoriteListParams): Record<string, string> {
  const query: Record<string, string> = {}
  if (params.page !== undefined && params.page > 1) {
    query.page = String(params.page)
  }
  if (params.page_size !== undefined) {
    query.page_size = String(params.page_size)
  }
  return query
}

/**
 * Fetches a paginated list of favorited products.
 */
export async function fetchFavorites(
  params: FavoriteListParams = {},
): Promise<Paginated<ProductListItem>> {
  const { data } = await http.get<Paginated<ProductListItem>>('/api/favorites/', {
    params: toQueryParams(params),
  })
  return data
}

/**
 * Adds a product to favorites (idempotent on the backend).
 */
export async function addFavorite(productId: string): Promise<Favorite> {
  const { data } = await http.post<Favorite>('/api/favorites/', {
    product_id: productId,
  })
  return data
}

/**
 * Removes a product from favorites.
 */
export async function removeFavorite(productId: string): Promise<void> {
  await http.delete(`/api/favorites/${productId}/`)
}

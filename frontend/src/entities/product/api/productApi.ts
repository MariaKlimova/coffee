import { http } from '@shared/api'

import type {
  Paginated,
  Product,
  ProductListItem,
  ProductListParams,
} from './productApi.typings'

function toQueryParams(params: ProductListParams): Record<string, string> {
  const query: Record<string, string> = {}

  if (params.category) {
    query.category = params.category
  }
  if (params.in_stock !== undefined) {
    query.in_stock = String(params.in_stock)
  }
  if (params.price_min) {
    query.price_min = params.price_min
  }
  if (params.price_max) {
    query.price_max = params.price_max
  }
  if (params.search) {
    query.search = params.search
  }
  if (params.ordering) {
    query.ordering = params.ordering
  }
  if (params.page !== undefined && params.page > 1) {
    query.page = String(params.page)
  }
  if (params.page_size !== undefined) {
    query.page_size = String(params.page_size)
  }

  return query
}

/**
 * Fetches a paginated product list with optional filters.
 */
export async function fetchProducts(
  params: ProductListParams = {},
): Promise<Paginated<ProductListItem>> {
  const { data } = await http.get<Paginated<ProductListItem>>('/api/products/', {
    params: toQueryParams(params),
  })
  return data
}

/**
 * Fetches a single product by slug.
 */
export async function fetchProduct(slug: string): Promise<Product> {
  const { data } = await http.get<Product>(`/api/products/${slug}/`)
  return data
}

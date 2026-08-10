import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { fetchProduct, fetchProducts } from '../api/productApi'
import type { ProductListParams } from '../api/productApi.typings'

export const productKeys = {
  all: ['products'] as const,
  list: (params: ProductListParams) => [...productKeys.all, 'list', params] as const,
  detail: (slug: string) => [...productKeys.all, 'detail', slug] as const,
}

/**
 * Cached product list keyed by filter params.
 * Keeps previous page data while the next page loads.
 */
export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => fetchProducts(params),
    placeholderData: keepPreviousData,
  })
}

interface UseProductOptions {
  /** When false, the detail request is not sent. */
  enabled?: boolean
}

/**
 * Cached product detail by slug (used when a card is expanded).
 */
export function useProduct(slug: string, options: UseProductOptions = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: productKeys.detail(slug),
    queryFn: () => fetchProduct(slug),
    enabled: enabled && Boolean(slug),
  })
}

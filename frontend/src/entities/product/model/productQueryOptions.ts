import { queryOptions } from '@tanstack/react-query'

import { fetchProducts } from '../api/productApi'
import type { ProductListParams } from '../api/productApi.typings'

export const productKeys = {
  all: ['products'] as const,
  list: (params: ProductListParams) => [...productKeys.all, 'list', params] as const,
  detail: (slug: string) => [...productKeys.all, 'detail', slug] as const,
  related: (slug: string) => [...productKeys.all, 'related', slug] as const,
}

/**
 * Общие параметры кэширования списка товаров каталога.
 */
export function productsQueryOptions(params: ProductListParams) {
  return queryOptions({
    queryKey: productKeys.list(params),
    queryFn: () => fetchProducts(params),
  })
}

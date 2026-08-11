import { queryOptions } from '@tanstack/react-query'

import { fetchProducts } from '../api/productApi'
import type { ProductListParams, ProductOrdering } from '../api/productApi.typings'
import type { ProductCategorySlug } from '../product.const'

/**
 * Identifies a "which catalog page holds this slug" lookup.
 */
interface ProductPageLookup {
  /** Slug being located. */
  slug: string
  /** Category listing that is scanned, undefined while the detail is loading. */
  category: ProductCategorySlug | undefined
  /** Ordering the listing is scanned with. */
  ordering: ProductOrdering
}

export const productKeys = {
  all: ['products'] as const,
  list: (params: ProductListParams) => [...productKeys.all, 'list', params] as const,
  detail: (slug: string) => [...productKeys.all, 'detail', slug] as const,
  pageOf: (lookup: ProductPageLookup) =>
    [...productKeys.all, 'page-of', lookup] as const,
}

/**
 * Single source of the product list query key — deep-link resolver and catalog
 * share the cache entry, so the storefront opens without a repeated request.
 */
export function productsQueryOptions(params: ProductListParams) {
  return queryOptions({
    queryKey: productKeys.list(params),
    queryFn: () => fetchProducts(params),
  })
}

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { fetchProduct, fetchRelatedProducts } from '../api/productApi'
import type { ProductListParams } from '../api/productApi.typings'
import { productKeys, productsQueryOptions } from './productQueryOptions'

/**
 * Cached product list keyed by filter params.
 * Keeps previous page data while the next page loads.
 */
export function useProducts(params: ProductListParams) {
  return useQuery({
    ...productsQueryOptions(params),
    placeholderData: keepPreviousData,
  })
}

interface UseProductOptions {
  /** When false, the detail request is not sent. */
  enabled?: boolean
}

/**
 * Детали товара по slug для самостоятельной страницы.
 */
export function useProduct(slug: string, options: UseProductOptions = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: productKeys.detail(slug),
    queryFn: () => fetchProduct(slug),
    enabled: enabled && Boolean(slug),
  })
}

interface UseRelatedProductsOptions {
  /** When false, the related request is not sent. */
  enabled?: boolean
}

/**
 * Похожие товары той же категории, исключая текущий.
 */
export function useRelatedProducts(
  slug: string,
  options: UseRelatedProductsOptions = {},
) {
  const { enabled = true } = options
  return useQuery({
    queryKey: productKeys.related(slug),
    queryFn: () => fetchRelatedProducts(slug),
    enabled: enabled && Boolean(slug),
  })
}

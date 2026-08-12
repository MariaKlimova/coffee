import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchProduct, fetchRelatedProducts } from '../api/productApi'
import type { ProductListParams, ProductOrdering } from '../api/productApi.typings'
import type { ProductCategorySlug } from '../product.const'
import { findProductPage } from './findProductPage'
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

interface UseRelatedProductsOptions {
  /** When false, the related request is not sent. */
  enabled?: boolean
}

/**
 * Related products for the expanded card strip (same category, excluding self).
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

interface UseProductPageNumberOptions {
  /** Slug to locate in the listing. */
  slug: string
  /** Category of the product — unknown until the detail request resolves. */
  category?: ProductCategorySlug
  /** Ordering the storefront uses for the same listing. */
  ordering: ProductOrdering
  /** When false, the scan is not started. */
  enabled?: boolean
}

/**
 * Resolves the catalog page a product lives on, so a deep link can open the
 * storefront on the page where the card is actually rendered.
 */
export function useProductPageNumber({
  slug,
  category,
  ordering,
  enabled = true,
}: UseProductPageNumberOptions) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: productKeys.pageOf({ slug, category, ordering }),
    queryFn: () => {
      if (!category) {
        throw new Error('Product category is required to resolve its catalog page')
      }
      return findProductPage({ queryClient, slug, category, ordering })
    },
    enabled: enabled && Boolean(slug) && Boolean(category),
  })
}

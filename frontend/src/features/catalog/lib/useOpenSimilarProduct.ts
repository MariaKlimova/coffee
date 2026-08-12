import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { findProductPage, type ProductCategorySlug } from '@entities/product'
import { useToast } from '@shared/ui'

import { CATALOG_COPY } from '../catalog.const'
import { useCatalogParams } from './useCatalogParams'

/**
 * Resolves which catalog page a related product lives on and opens it.
 * Retries without filters when the current filter set excludes the product.
 */
export function useOpenSimilarProduct(category: ProductCategorySlug) {
  const queryClient = useQueryClient()
  const { params, openProductAt } = useCatalogParams()
  const { showToast } = useToast()
  const [isPending, setIsPending] = useState(false)

  async function openProduct(slug: string): Promise<void> {
    if (isPending || !slug) {
      return
    }

    setIsPending(true)
    try {
      const filteredPage = await findProductPage({
        queryClient,
        slug,
        category,
        ordering: params.ordering,
        in_stock: params.inStockOnly ? true : undefined,
        price_min: params.priceMin,
        price_max: params.priceMax,
      })

      if (filteredPage !== null) {
        openProductAt({ slug, page: filteredPage, resetFilters: false })
        return
      }

      const unfilteredPage = await findProductPage({
        queryClient,
        slug,
        category,
        ordering: params.ordering,
      })

      if (unfilteredPage === null) {
        showToast({
          message: CATALOG_COPY.similarNotFoundToast,
          variant: 'error',
        })
        return
      }

      openProductAt({ slug, page: unfilteredPage, resetFilters: true })
      showToast({
        message: CATALOG_COPY.filtersResetToast,
        variant: 'info',
      })
    } catch {
      showToast({
        message: CATALOG_COPY.similarOpenErrorToast,
        variant: 'error',
      })
    } finally {
      setIsPending(false)
    }
  }

  return {
    openProduct,
    isPending,
  }
}

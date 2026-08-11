import type { QueryClient } from '@tanstack/react-query'

import type { ProductOrdering } from '../api/productApi.typings'
import { productsQueryOptions } from '../model/productQueryOptions'
import {
  CATALOG_PAGE_SIZE,
  MAX_SCANNED_PAGES,
  type ProductCategorySlug,
} from '../product.const'

/**
 * Inputs for locating a product inside the unfiltered category listing.
 */
export interface FindProductPageParams {
  /** Query client whose cache the catalog page reuses afterwards. */
  queryClient: QueryClient
  /** Slug to look for. */
  slug: string
  /** Category listing to scan. */
  category: ProductCategorySlug
  /** Ordering the storefront uses for the same listing. */
  ordering: ProductOrdering
}

/**
 * Walks the listing page by page until the slug shows up.
 * Returns null when the product is not part of the listing at all.
 */
export async function findProductPage({
  queryClient,
  slug,
  category,
  ordering,
}: FindProductPageParams): Promise<number | null> {
  let page = 1

  for (;;) {
    const data = await queryClient.fetchQuery(
      productsQueryOptions({
        category,
        page,
        page_size: CATALOG_PAGE_SIZE,
        ordering,
      }),
    )

    if (data.results.some((item) => item.slug === slug)) {
      return page
    }
    if (!data.next || page >= MAX_SCANNED_PAGES) {
      return null
    }
    page += 1
  }
}

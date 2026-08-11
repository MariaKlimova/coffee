import { Link, Navigate, useParams } from 'react-router-dom'

import {
  CATEGORY_ROUTES,
  DEFAULT_CATALOG_ROUTE,
  useProduct,
  useProductPageNumber,
} from '@entities/product'
import {
  buildCatalogSearchParams,
  CATALOG_COPY,
  DEFAULT_ORDERING,
} from '@features/catalog'
import { isNotFoundError } from '@shared/api'
import { Button, EmptyState, ProductCardSkeleton } from '@shared/ui'

import { PRODUCT_PAGE_COPY } from './ProductPage.const'
import styles from './ProductPage.module.css'

/**
 * Resolves `/product/:slug` into a storefront URL: the category route, the page
 * the product actually sits on, and `?product=` so the card opens expanded.
 */
export function ProductPage() {
  const { slug = '' } = useParams()

  const detailQuery = useProduct(slug)
  const pageQuery = useProductPageNumber({
    slug,
    category: detailQuery.data?.category,
    ordering: DEFAULT_ORDERING,
    enabled: detailQuery.isSuccess,
  })

  if (isNotFoundError(detailQuery.error)) {
    return (
      <section className={styles.ProductPage}>
        <EmptyState
          title={PRODUCT_PAGE_COPY.notFoundTitle}
          description={PRODUCT_PAGE_COPY.notFoundDescription}
          action={
            <Link
              to={DEFAULT_CATALOG_ROUTE}
              className={styles['ProductPage-CatalogLink']}
            >
              {PRODUCT_PAGE_COPY.backToCatalog}
            </Link>
          }
        />
      </section>
    )
  }

  if (detailQuery.isError || pageQuery.isError) {
    return (
      <section className={styles.ProductPage}>
        <EmptyState
          title={CATALOG_COPY.detailErrorTitle}
          description={CATALOG_COPY.detailErrorDescription}
          action={
            <Button
              type="button"
              onClick={() => {
                if (detailQuery.isError) {
                  void detailQuery.refetch()
                  return
                }
                void pageQuery.refetch()
              }}
            >
              {CATALOG_COPY.retry}
            </Button>
          }
        />
      </section>
    )
  }

  if (detailQuery.isSuccess && pageQuery.isSuccess) {
    const page = pageQuery.data
    const search = buildCatalogSearchParams({
      inStockOnly: false,
      ordering: DEFAULT_ORDERING,
      page: page ?? 1,
      product: page ? slug : null,
    })

    return (
      <Navigate
        replace
        to={{
          pathname: CATEGORY_ROUTES[detailQuery.data.category],
          search: search.toString(),
        }}
      />
    )
  }

  return (
    <section
      className={styles.ProductPage}
      role="status"
      aria-live="polite"
      aria-label={PRODUCT_PAGE_COPY.loadingLabel}
    >
      <ProductCardSkeleton className={styles['ProductPage-Loading']} />
    </section>
  )
}

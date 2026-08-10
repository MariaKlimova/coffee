import { useEffect } from 'react'

import {
  CATALOG_PAGE_SIZE,
  CATEGORY_LABELS,
  useProducts,
  type ProductListParams,
} from '@entities/product'
import {
  CATALOG_COPY,
  CatalogFilters,
  CatalogPagination,
  useCatalogParams,
} from '@features/catalog'
import { Button, EmptyState, ProductCardSkeleton } from '@shared/ui'

import { CatalogPageItem } from './CatalogPage-Item'
import type { CatalogPageProps } from './CatalogPage.typings'
import styles from './CatalogPage.module.css'

export function CatalogPage({ category }: CatalogPageProps) {
  const {
    params,
    setFilters,
    setPage,
    expandProduct,
    collapseProduct,
    clearProduct,
    resetFilters,
  } = useCatalogParams()

  const listParams: ProductListParams = {
    category,
    page: params.page,
    page_size: CATALOG_PAGE_SIZE,
    ordering: params.ordering,
  }
  if (params.inStockOnly) {
    listParams.in_stock = true
  }
  if (params.priceMin) {
    listParams.price_min = params.priceMin
  }
  if (params.priceMax) {
    listParams.price_max = params.priceMax
  }

  const productsQuery = useProducts(listParams)
  const products = productsQuery.data?.results ?? []
  const count = productsQuery.data?.count ?? 0
  const skeletonCount = products.length > 0 ? products.length : CATALOG_PAGE_SIZE
  const showInitialSkeleton = productsQuery.isPending && !productsQuery.data
  const expandedSlug =
    params.product && products.some((item) => item.slug === params.product)
      ? params.product
      : null

  useEffect(() => {
    if (!productsQuery.isSuccess || !params.product || !productsQuery.data) {
      return
    }
    const onCurrentPage = productsQuery.data.results.some(
      (item) => item.slug === params.product,
    )
    if (!onCurrentPage) {
      clearProduct()
    }
  }, [productsQuery.isSuccess, productsQuery.data, params.product, clearProduct])

  return (
    <section className={styles.CatalogPage}>
      <h1 className={styles['CatalogPage-Title']}>{CATEGORY_LABELS[category]}</h1>

      <div className={styles['CatalogPage-Layout']}>
        <aside className={styles['CatalogPage-Sidebar']}>
          <CatalogFilters
            priceMin={params.priceMin}
            priceMax={params.priceMax}
            inStockOnly={params.inStockOnly}
            ordering={params.ordering}
            onChange={setFilters}
          />
        </aside>

        <div className={styles['CatalogPage-Content']}>
          {productsQuery.isError ? (
            <EmptyState
              title={CATALOG_COPY.errorTitle}
              description={CATALOG_COPY.errorDescription}
              action={
                <Button
                  type="button"
                  onClick={() => {
                    void productsQuery.refetch()
                  }}
                >
                  {CATALOG_COPY.retry}
                </Button>
              }
            />
          ) : null}

          {!productsQuery.isError && showInitialSkeleton ? (
            <div
              className={styles['CatalogPage-Grid']}
              role="status"
              aria-live="polite"
              aria-label={CATALOG_COPY.loadingLabel}
            >
              {Array.from({ length: skeletonCount }, (_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : null}

          {!productsQuery.isError && !showInitialSkeleton && products.length === 0 ? (
            <EmptyState
              title={CATALOG_COPY.emptyTitle}
              description={CATALOG_COPY.emptyDescription}
              action={
                <Button type="button" onClick={resetFilters}>
                  {CATALOG_COPY.resetFilters}
                </Button>
              }
            />
          ) : null}

          {!productsQuery.isError && products.length > 0 ? (
            <>
              <div className={styles['CatalogPage-Grid']}>
                {products.map((product) => (
                  <CatalogPageItem
                    key={product.id}
                    product={product}
                    isExpanded={expandedSlug === product.slug}
                    onExpand={expandProduct}
                    onCollapse={collapseProduct}
                  />
                ))}
              </div>
              <CatalogPagination
                page={params.page}
                count={count}
                pageSize={CATALOG_PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}

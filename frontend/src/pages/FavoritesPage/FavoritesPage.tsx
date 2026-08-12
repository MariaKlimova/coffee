import { useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useFavorites } from '@entities/favorite'
import {
  CATALOG_PAGE_SIZE,
  DEFAULT_CATALOG_ROUTE,
  toProductCardProps,
} from '@entities/product'
import { CatalogPagination } from '@features/catalog'
import { useToggleFavorite } from '@features/toggle-favorite'
import { parsePageNumber } from '@shared/lib/parsePageNumber'
import { Button, EmptyState, ProductCard, ProductCardSkeleton } from '@shared/ui'

import { FAVORITES_PAGE_COPY } from './FavoritesPage.const'
import styles from './FavoritesPage.module.css'

/**
 * Authenticated favorites grid with pagination and optimistic unfavorite.
 */
export function FavoritesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePageNumber(searchParams.get('page'))
  const { toggleFavorite } = useToggleFavorite()

  const favoritesQuery = useFavorites({
    page,
    page_size: CATALOG_PAGE_SIZE,
  })
  const products = favoritesQuery.data?.results ?? []
  const count = favoritesQuery.data?.count ?? 0
  const skeletonCount = products.length > 0 ? products.length : CATALOG_PAGE_SIZE
  const showInitialSkeleton = favoritesQuery.isPending && !favoritesQuery.data
  const isDrainingExtraPage =
    favoritesQuery.isSuccess &&
    !favoritesQuery.isPlaceholderData &&
    page > 1 &&
    products.length === 0

  const setPage = useCallback(
    (nextPage: number): void => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (nextPage <= 1) {
            next.delete('page')
          } else {
            next.set('page', String(nextPage))
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  useEffect(() => {
    if (!isDrainingExtraPage) {
      return
    }
    setPage(page - 1)
  }, [isDrainingExtraPage, page, setPage])

  return (
    <section className={styles.FavoritesPage}>
      <h1 className={styles['FavoritesPage-Title']}>{FAVORITES_PAGE_COPY.title}</h1>

      {favoritesQuery.isError ? (
        <EmptyState
          title={FAVORITES_PAGE_COPY.errorTitle}
          action={
            <Button
              type="button"
              onClick={() => {
                void favoritesQuery.refetch()
              }}
            >
              {FAVORITES_PAGE_COPY.retry}
            </Button>
          }
        />
      ) : null}

      {!favoritesQuery.isError && showInitialSkeleton ? (
        <div
          className={styles['FavoritesPage-Grid']}
          role="status"
          aria-live="polite"
          aria-label={FAVORITES_PAGE_COPY.loadingLabel}
        >
          {Array.from({ length: skeletonCount }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : null}

      {!favoritesQuery.isError &&
      !showInitialSkeleton &&
      !isDrainingExtraPage &&
      !favoritesQuery.isPlaceholderData &&
      products.length === 0 ? (
        <EmptyState
          title={FAVORITES_PAGE_COPY.emptyTitle}
          description={FAVORITES_PAGE_COPY.emptyDescription}
          action={
            <Button to={DEFAULT_CATALOG_ROUTE}>
              {FAVORITES_PAGE_COPY.goToCatalog}
            </Button>
          }
        />
      ) : null}

      {!favoritesQuery.isError && products.length > 0 ? (
        <>
          <div className={styles['FavoritesPage-Grid']}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                {...toProductCardProps(product)}
                onExpand={() => {
                  void navigate(`/product/${product.slug}`)
                }}
                onToggleFavorite={(productId) => {
                  toggleFavorite(productId, product.is_favorite)
                }}
                // Stub until the cart epic wires a real handler (UUID is in `id`).
                onAddToCart={() => undefined}
              />
            ))}
          </div>
          <CatalogPagination
            page={page}
            count={count}
            pageSize={CATALOG_PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </section>
  )
}

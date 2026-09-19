import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ORDERS_PAGE_SIZE, useOrders } from '@entities/order'
import { DEFAULT_CATALOG_ROUTE } from '@entities/product'
import { CatalogPagination } from '@features/catalog'
import { ORDERS_PAGE_COPY } from '@shared/lib/copy'
import { parsePageNumber } from '@shared/lib/parsePageNumber'
import { Button, EmptyState } from '@shared/ui'

import { OrdersPageItem } from './OrdersPage-Item'
import styles from './OrdersPage.module.css'

/**
 * Список заказов авторизованного пользователя.
 */
export function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePageNumber(searchParams.get('page'))
  const ordersQuery = useOrders({
    page,
    page_size: ORDERS_PAGE_SIZE,
  })
  const orders = ordersQuery.data?.results ?? []
  const count = ordersQuery.data?.count ?? 0
  const skeletonCount = orders.length > 0 ? orders.length : 4
  const showInitialSkeleton = ordersQuery.isPending && !ordersQuery.data
  const isDrainingExtraPage =
    ordersQuery.isSuccess &&
    !ordersQuery.isPlaceholderData &&
    page > 1 &&
    orders.length === 0

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
    <section className={styles.OrdersPage}>
      <h1 className={styles['OrdersPage-Title']}>{ORDERS_PAGE_COPY.title}</h1>

      {ordersQuery.isError ? (
        <EmptyState
          title={ORDERS_PAGE_COPY.errorTitle}
          action={
            <Button
              type="button"
              onClick={() => {
                void ordersQuery.refetch()
              }}
            >
              {ORDERS_PAGE_COPY.retry}
            </Button>
          }
        />
      ) : null}

      {!ordersQuery.isError && showInitialSkeleton ? (
        <div
          className={styles['OrdersPage-SkeletonList']}
          role="status"
          aria-live="polite"
          aria-label={ORDERS_PAGE_COPY.loadingLabel}
        >
          {Array.from({ length: skeletonCount }, (_, index) => (
            <div key={index} className={styles['OrdersPage-SkeletonRow']} />
          ))}
        </div>
      ) : null}

      {!ordersQuery.isError &&
      !showInitialSkeleton &&
      !isDrainingExtraPage &&
      !ordersQuery.isPlaceholderData &&
      orders.length === 0 ? (
        <EmptyState
          title={ORDERS_PAGE_COPY.emptyTitle}
          description={ORDERS_PAGE_COPY.emptyDescription}
          action={
            <Button to={DEFAULT_CATALOG_ROUTE}>{ORDERS_PAGE_COPY.goToCatalog}</Button>
          }
        />
      ) : null}

      {!ordersQuery.isError && orders.length > 0 ? (
        <>
          <div className={styles['OrdersPage-List']}>
            {orders.map((order) => (
              <OrdersPageItem key={order.id} order={order} />
            ))}
          </div>
          <CatalogPagination
            page={page}
            count={count}
            pageSize={ORDERS_PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </section>
  )
}

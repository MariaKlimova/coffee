import { useCart, useCartMutations } from '@entities/cart'
import { DEFAULT_CATALOG_ROUTE } from '@entities/product'
import { CART_PAGE_COPY } from '@shared/lib/copy'
import { Button, EmptyState } from '@shared/ui'

import { CartPageItem } from './CartPage-Item'
import { CartPageSkeleton } from './CartPage-Skeleton'
import { CartPageSummary } from './CartPage-Summary'
import { CART_SKELETON_ROWS, sumAvailableLineTotals } from './CartPage.const'
import styles from './CartPage.module.css'

/**
 * Страница корзины: список позиций, итог и переход к оформлению.
 */
export function CartPage() {
  const cartQuery = useCart()
  const { updateItem, removeItem } = useCartMutations()

  const items = cartQuery.data?.items ?? []
  const showInitialSkeleton = cartQuery.isPending && !cartQuery.data
  const availableTotal = sumAvailableLineTotals(items)
  const canCheckout = items.some((item) => item.product.in_stock)

  return (
    <section className={styles.CartPage}>
      <h1 className={styles['CartPage-Title']}>{CART_PAGE_COPY.title}</h1>

      {cartQuery.isError ? (
        <EmptyState
          title={CART_PAGE_COPY.errorTitle}
          action={
            <Button
              type="button"
              onClick={() => {
                void cartQuery.refetch()
              }}
            >
              {CART_PAGE_COPY.retry}
            </Button>
          }
        />
      ) : null}

      {!cartQuery.isError && showInitialSkeleton ? (
        <div
          className={styles['CartPage-SkeletonList']}
          role="status"
          aria-live="polite"
          aria-label={CART_PAGE_COPY.loadingLabel}
        >
          {Array.from({ length: CART_SKELETON_ROWS }, (_, index) => (
            <CartPageSkeleton key={index} />
          ))}
        </div>
      ) : null}

      {!cartQuery.isError &&
      !showInitialSkeleton &&
      cartQuery.isSuccess &&
      items.length === 0 ? (
        <EmptyState
          title={CART_PAGE_COPY.emptyTitle}
          description={CART_PAGE_COPY.emptyDescription}
          action={
            <Button to={DEFAULT_CATALOG_ROUTE}>{CART_PAGE_COPY.goToCatalog}</Button>
          }
        />
      ) : null}

      {!cartQuery.isError && items.length > 0 ? (
        <div className={styles['CartPage-Layout']}>
          <div className={styles['CartPage-List']}>
            {items.map((item) => (
              <CartPageItem
                key={item.id}
                item={item}
                onQuantityChange={(itemId, quantity) => {
                  updateItem.mutate({ itemId, quantity })
                }}
                onRemove={(itemId) => {
                  removeItem.mutate({ itemId })
                }}
              />
            ))}
          </div>
          <div className={styles['CartPage-SummarySlot']}>
            <CartPageSummary total={availableTotal} canCheckout={canCheckout} />
          </div>
        </div>
      ) : null}
    </section>
  )
}

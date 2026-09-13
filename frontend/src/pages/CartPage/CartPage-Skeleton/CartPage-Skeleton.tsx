import { cx } from '@shared/lib/cx'

import styles from './CartPage-Skeleton.module.css'

/**
 * Построчный skeleton позиции корзины.
 */
export function CartPageSkeleton() {
  return (
    <div className={styles['CartPage-Skeleton']} aria-hidden>
      <div
        className={cx(
          styles['CartPage-Skeleton-Line'],
          styles['CartPage-Skeleton-Line--media'],
        )}
      />
      <div className={styles['CartPage-Skeleton-Body']}>
        <div
          className={cx(
            styles['CartPage-Skeleton-Line'],
            styles['CartPage-Skeleton-Line--title'],
          )}
        />
        <div
          className={cx(
            styles['CartPage-Skeleton-Line'],
            styles['CartPage-Skeleton-Line--meta'],
          )}
        />
        <div
          className={cx(
            styles['CartPage-Skeleton-Line'],
            styles['CartPage-Skeleton-Line--controls'],
          )}
        />
      </div>
      <div
        className={cx(
          styles['CartPage-Skeleton-Line'],
          styles['CartPage-Skeleton-Line--total'],
        )}
      />
    </div>
  )
}

import { cx } from '@shared/lib/cx'

import type { ProductCardSkeletonProps } from './ProductCardSkeleton.typings'
import styles from './ProductCardSkeleton.module.css'

export function ProductCardSkeleton({ className }: ProductCardSkeletonProps) {
  return (
    <div className={cx(styles.ProductCardSkeleton, className)} aria-hidden>
      <div className={styles['ProductCardSkeleton-Media']}>
        <div
          className={cx(
            styles['ProductCardSkeleton-Line'],
            styles['ProductCardSkeleton-Line--media'],
          )}
        />
      </div>
      <div className={styles['ProductCardSkeleton-Body']}>
        <div
          className={cx(
            styles['ProductCardSkeleton-Line'],
            styles['ProductCardSkeleton-Line--title'],
          )}
        />
        <div
          className={cx(
            styles['ProductCardSkeleton-Line'],
            styles['ProductCardSkeleton-Line--desc'],
          )}
        />
        <div
          className={cx(
            styles['ProductCardSkeleton-Line'],
            styles['ProductCardSkeleton-Line--price'],
          )}
        />
      </div>
    </div>
  )
}

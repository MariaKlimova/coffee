import { toProductCardProps, useRelatedProducts } from '@entities/product'
import { cx } from '@shared/lib/cx'
import { ProductCard, ProductCardSkeleton } from '@shared/ui'

import { CATALOG_COPY } from '../../catalog.const'
import { SIMILAR_SKELETON_COUNT } from './SimilarProducts.const'
import type { SimilarProductsProps } from './SimilarProducts.typings'
import styles from './SimilarProducts.module.css'

export function SimilarProducts({
  slug,
  onSelect,
  disabled = false,
}: SimilarProductsProps) {
  const relatedQuery = useRelatedProducts(slug, { enabled: Boolean(slug) })

  if (relatedQuery.isError) {
    return null
  }

  if (relatedQuery.isPending) {
    return (
      <section className={styles.SimilarProducts} aria-busy="true">
        <h3 className={styles['SimilarProducts-Title']}>{CATALOG_COPY.similarTitle}</h3>
        <div
          className={styles['SimilarProducts-Strip']}
          role="region"
          aria-label={CATALOG_COPY.similarStripLabel}
          tabIndex={0}
        >
          {Array.from({ length: SIMILAR_SKELETON_COUNT }, (_, index) => (
            <div key={index} className={styles['SimilarProducts-Item']}>
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      </section>
    )
  }

  const items = relatedQuery.data ?? []
  if (items.length === 0) {
    return null
  }

  return (
    <section
      className={cx(
        styles.SimilarProducts,
        disabled && styles['SimilarProducts--disabled'],
      )}
    >
      <h3 className={styles['SimilarProducts-Title']}>{CATALOG_COPY.similarTitle}</h3>
      <div
        className={styles['SimilarProducts-Strip']}
        role="region"
        aria-label={CATALOG_COPY.similarStripLabel}
        tabIndex={0}
      >
        {items.map((item) => (
          <div key={item.id} className={styles['SimilarProducts-Item']}>
            <ProductCard
              {...toProductCardProps(item)}
              onExpand={() => {
                if (disabled) {
                  return
                }
                onSelect(item.slug)
              }}
              onToggleFavorite={() => undefined}
              onAddToCart={() => undefined}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

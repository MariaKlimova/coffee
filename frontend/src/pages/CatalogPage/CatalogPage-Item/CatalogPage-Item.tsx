import { toExpandedCardProps, toProductCardProps, useProduct } from '@entities/product'
import { CATALOG_COPY } from '@features/catalog'
import {
  Button,
  EmptyState,
  ExpandedProductCard,
  ProductCard,
  ProductCardSkeleton,
} from '@shared/ui'

import type { CatalogPageItemProps } from './CatalogPage-Item.typings'
import styles from './CatalogPage-Item.module.css'

export function CatalogPageItem({
  product,
  isExpanded,
  onExpand,
  onCollapse,
}: CatalogPageItemProps) {
  const detailQuery = useProduct(product.slug, { enabled: isExpanded })

  if (!isExpanded) {
    return (
      <ProductCard
        {...toProductCardProps(product)}
        onExpand={() => {
          onExpand(product.slug)
        }}
        // Stubs until favorites / cart epics wire real handlers (UUID is in `id`).
        onToggleFavorite={() => undefined}
        onAddToCart={() => undefined}
      />
    )
  }

  if (detailQuery.isError) {
    return (
      <div className={styles['CatalogPage-ItemError']} role="alert">
        <EmptyState
          title={CATALOG_COPY.detailErrorTitle}
          description={CATALOG_COPY.detailErrorDescription}
          action={
            <div className={styles['CatalogPage-ItemErrorActions']}>
              <Button
                type="button"
                onClick={() => {
                  void detailQuery.refetch()
                }}
              >
                {CATALOG_COPY.retry}
              </Button>
              <Button type="button" variant="secondary" onClick={onCollapse}>
                {CATALOG_COPY.close}
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  if (!detailQuery.isSuccess) {
    return <ProductCardSkeleton className={styles['CatalogPage-ItemSkeleton']} />
  }

  const expandedProps = toExpandedCardProps(detailQuery.data)
  if (expandedProps.category === 'coffee') {
    return <ExpandedProductCard {...expandedProps} onClose={onCollapse} />
  }

  return <ExpandedProductCard {...expandedProps} onClose={onCollapse} />
}

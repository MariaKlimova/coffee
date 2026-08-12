import { useEffect, useRef } from 'react'

import { toExpandedCardProps, toProductCardProps, useProduct } from '@entities/product'
import { CATALOG_COPY, SimilarProducts, useOpenSimilarProduct } from '@features/catalog'
import {
  Button,
  EmptyState,
  ExpandedProductCard,
  ProductCard,
  ProductCardSkeleton,
  type ExpandedProductCardProps,
} from '@shared/ui'

import { buildProductTitle } from './CatalogPage-Item.const'
import type { CatalogPageItemProps } from './CatalogPage-Item.typings'
import styles from './CatalogPage-Item.module.css'

export function CatalogPageItem({
  product,
  isExpanded,
  onExpand,
  onCollapse,
}: CatalogPageItemProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const detailQuery = useProduct(product.slug, { enabled: isExpanded })
  const { openProduct, isPending } = useOpenSimilarProduct(product.category)

  useEffect(() => {
    if (!isExpanded || !detailQuery.isSuccess) {
      return
    }
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const prefersReducedMotion = mediaQuery?.matches ?? false
    rootRef.current?.scrollIntoView?.({
      block: 'nearest',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [isExpanded, detailQuery.isSuccess, product.slug])

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

  // Union + onClose: assemble once so JSX does not need two identical branches.
  const expandedCardProps = {
    ...toExpandedCardProps(detailQuery.data),
    onClose: onCollapse,
    similarSlot: (
      <SimilarProducts
        slug={product.slug}
        disabled={isPending}
        onSelect={(slug) => {
          void openProduct(slug)
        }}
      />
    ),
  } as ExpandedProductCardProps

  return (
    <div ref={rootRef}>
      {/* React 19 hoists this into <head>: works for deep links and in-grid expand alike. */}
      <title>{buildProductTitle(detailQuery.data.name)}</title>
      <ExpandedProductCard {...expandedCardProps} />
    </div>
  )
}

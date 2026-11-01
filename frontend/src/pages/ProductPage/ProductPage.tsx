import { useEffect, useRef } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'

import {
  CATEGORY_ROUTES,
  DEFAULT_CATALOG_ROUTE,
  toExpandedCardProps,
  useProduct,
} from '@entities/product'
import { useCartLineActions } from '@features/add-to-cart'
import {
  CATALOG_COPY,
  SimilarProducts,
  getCatalogScroll,
  productPath,
  safeCatalogReturn,
} from '@features/catalog'
import { useToggleFavorite } from '@features/toggle-favorite'
import { isNotFoundError } from '@shared/api'
import { SITE_TITLE } from '@shared/config'
import { PRODUCT_PAGE_COPY } from '@shared/lib/copy'
import {
  Button,
  EmptyState,
  ExpandedProductCard,
  ProductCardSkeleton,
  type ExpandedProductCardProps,
} from '@shared/ui'

import styles from './ProductPage.module.css'

/** Отдельная страница товара; список каталога не участвует в загрузке деталей. */
export function ProductPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const rootRef = useRef<HTMLElement>(null)
  const detailQuery = useProduct(slug)
  const { toggleFavorite } = useToggleFavorite()
  const { getQuantity, setQuantity, addToCart } = useCartLineActions()
  const returnTo = safeCatalogReturn(searchParams.get('returnTo'))
  const catalogHref =
    returnTo ??
    (detailQuery.data
      ? CATEGORY_ROUTES[detailQuery.data.category]
      : DEFAULT_CATALOG_ROUTE)
  const scrollY = getCatalogScroll(location.state)

  useEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previous
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [slug])

  useEffect(() => {
    if (detailQuery.isPending) return
    const heading = rootRef.current?.querySelector<HTMLElement>('h1, h2')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus({ preventScroll: true })
  }, [slug, detailQuery.isPending, detailQuery.status])

  const backLink = (
    <Link
      className={styles['ProductPage-Back']}
      to={catalogHref}
      state={scrollY === undefined ? null : { catalogScrollY: scrollY }}
    >
      {PRODUCT_PAGE_COPY.backToCatalog}
    </Link>
  )

  if (isNotFoundError(detailQuery.error)) {
    return (
      <section ref={rootRef} className={styles.ProductPage}>
        <EmptyState
          title={PRODUCT_PAGE_COPY.notFoundTitle}
          description={PRODUCT_PAGE_COPY.notFoundDescription}
          action={backLink}
        />
      </section>
    )
  }

  if (detailQuery.isError) {
    return (
      <section ref={rootRef} className={styles.ProductPage}>
        {backLink}
        <EmptyState
          title={CATALOG_COPY.detailErrorTitle}
          description={CATALOG_COPY.detailErrorDescription}
          action={
            <Button type="button" onClick={() => void detailQuery.refetch()}>
              {CATALOG_COPY.retry}
            </Button>
          }
        />
      </section>
    )
  }

  if (!detailQuery.isSuccess) {
    return (
      <section
        ref={rootRef}
        className={styles.ProductPage}
        role="status"
        aria-live="polite"
        aria-label={PRODUCT_PAGE_COPY.loadingLabel}
      >
        {backLink}
        <ProductCardSkeleton className={styles['ProductPage-Loading']} />
      </section>
    )
  }

  const product = detailQuery.data
  const cardProps = {
    ...toExpandedCardProps(product),
    presentation: 'page',
    cartQuantity: getQuantity(product.id),
    onCartQuantityChange: setQuantity,
    onToggleFavorite: (id: string) => toggleFavorite(id, product.is_favorite),
    onAddToCart: addToCart,
    similarSlot: (
      <SimilarProducts
        slug={product.slug}
        productHref={(relatedSlug) => productPath(relatedSlug, returnTo)}
        linkState={location.state}
        onToggleFavorite={toggleFavorite}
        getCartQuantity={getQuantity}
        onAddToCart={(id) => addToCart(id, 1)}
        onCartQuantityChange={setQuantity}
      />
    ),
  } satisfies ExpandedProductCardProps

  return (
    <section ref={rootRef} className={styles.ProductPage}>
      <title>{`${product.name} — ${SITE_TITLE}`}</title>
      {backLink}
      <ExpandedProductCard key={slug} {...cardProps} />
    </section>
  )
}

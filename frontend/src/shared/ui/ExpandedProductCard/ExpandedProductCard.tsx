import { useEffect, useState } from 'react'

import { CART_COPY, CLOSE, FAVORITE_COPY, PRODUCT_PAGE_COPY } from '@shared/lib/copy'
import { cx } from '@shared/lib/cx'
import { Badge } from '@shared/ui/Badge'
import { Button } from '@shared/ui/Button'
import { HeartIcon } from '@shared/ui/icons'
import { ImageCarousel } from '@shared/ui/ImageCarousel'

import { COFFEE_SCALES, MACHINE_ROWS } from './ExpandedProductCard.const'
import type { ExpandedProductCardProps } from './ExpandedProductCard.typings'
import { ScaleRow } from './ScaleRow'
import styles from './ExpandedProductCard.module.css'

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AttrIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  )
}

export function ExpandedProductCard(props: ExpandedProductCardProps) {
  const {
    id,
    category,
    categoryLabel,
    title,
    description,
    images,
    price,
    oldPrice,
    onClose,
    presentation = 'inline',
    cartQuantity = 0,
    onCartQuantityChange,
    isFavorite = false,
    onToggleFavorite,
    inStock = true,
    onAddToCart,
    similarSlot,
    className,
    attributes,
    ...rest
  } = props

  const inCart = cartQuantity > 0 && Boolean(onCartQuantityChange)
  const titleId = `${id}-expanded-title`
  const quantityId = `${id}-quantity`
  const [quantity, setQuantity] = useState(1)
  const displayedQuantity = inCart ? cartQuantity : quantity

  useEffect(() => {
    if (!onClose) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <article
      {...rest}
      className={cx(
        styles.ExpandedProductCard,
        presentation === 'page' && styles['ExpandedProductCard--page'],
        className,
      )}
      aria-labelledby={titleId}
    >
      <div className={styles['ExpandedProductCard-Media']}>
        <ImageCarousel images={images} alt={title} size="expanded" />
      </div>

      <div className={styles['ExpandedProductCard-Info']}>
        <div className={styles['ExpandedProductCard-Actions']}>
          {onToggleFavorite ? (
            <button
              type="button"
              className={styles['ExpandedProductCard-Favorite']}
              aria-label={isFavorite ? FAVORITE_COPY.remove : FAVORITE_COPY.add}
              aria-pressed={isFavorite}
              onClick={() => {
                onToggleFavorite(id)
              }}
            >
              <HeartIcon filled={isFavorite} />
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              className={styles['ExpandedProductCard-Close']}
              aria-label={CLOSE}
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>

        <p
          className={cx(
            styles['ExpandedProductCard-Category'],
            category === 'coffee'
              ? styles['ExpandedProductCard-Category--coffee']
              : styles['ExpandedProductCard-Category--machines'],
          )}
        >
          {categoryLabel}
        </p>
        {presentation === 'page' ? (
          <h1 className={styles['ExpandedProductCard-Title']} id={titleId}>
            {title}
          </h1>
        ) : (
          <h2 className={styles['ExpandedProductCard-Title']} id={titleId}>
            {title}
          </h2>
        )}
        <p className={styles['ExpandedProductCard-Description']}>{description}</p>
        <div className={styles['ExpandedProductCard-PriceRow']}>
          {oldPrice ? (
            <span className={styles['ExpandedProductCard-OldPrice']}>{oldPrice}</span>
          ) : null}
          <span className={styles['ExpandedProductCard-Price']}>{price}</span>
        </div>

        {!inStock ? <Badge>{CART_COPY.outOfStock}</Badge> : null}

        {onAddToCart ? (
          <div className={styles['ExpandedProductCard-CartRow']}>
            <div
              className={styles['ExpandedProductCard-Qty']}
              role="group"
              aria-label={CART_COPY.quantityLabel}
            >
              <button
                type="button"
                className={styles['ExpandedProductCard-QtyButton']}
                aria-label={CART_COPY.decreaseQty}
                disabled={!inStock || (!inCart && quantity <= 1)}
                onClick={() => {
                  if (inCart) onCartQuantityChange?.(id, cartQuantity - 1)
                  else setQuantity((value) => Math.max(1, value - 1))
                }}
              >
                −
              </button>
              <span
                id={quantityId}
                className={styles['ExpandedProductCard-QtyValue']}
                aria-live="polite"
              >
                {displayedQuantity}
              </span>
              <button
                type="button"
                className={styles['ExpandedProductCard-QtyButton']}
                aria-label={CART_COPY.increaseQty}
                disabled={!inStock}
                onClick={() => {
                  if (inCart) onCartQuantityChange?.(id, cartQuantity + 1)
                  else setQuantity((value) => value + 1)
                }}
              >
                +
              </button>
            </div>
            {!inCart ? (
              <Button
                className={styles['ExpandedProductCard-AddToCart']}
                disabled={!inStock}
                onClick={() => {
                  onAddToCart(id, quantity)
                }}
              >
                {CART_COPY.addCta}
              </Button>
            ) : null}
          </div>
        ) : null}

        <p className={styles['ExpandedProductCard-AttrsTitle']}>
          {PRODUCT_PAGE_COPY.attributesTitle}
        </p>

        {category === 'coffee' ? (
          <>
            <p className={styles['ExpandedProductCard-Origin']}>
              {PRODUCT_PAGE_COPY.countryLabel}: {attributes.originCountry}
            </p>
            {COFFEE_SCALES.map((scale) => (
              <ScaleRow
                key={scale.key}
                label={scale.label}
                value={attributes[scale.key]}
                max={scale.max}
              />
            ))}
          </>
        ) : (
          <ul className={styles['ExpandedProductCard-MachineList']}>
            {MACHINE_ROWS.map((row) => (
              <li key={row.key} className={styles['ExpandedProductCard-MachineRow']}>
                <span className={styles['ExpandedProductCard-MachineIcon']}>
                  <AttrIcon />
                </span>
                <span className={styles['ExpandedProductCard-MachineLabel']}>
                  {row.label}
                </span>
                <span className={styles['ExpandedProductCard-MachineValue']}>
                  {attributes[row.key]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {similarSlot ? (
        <div className={styles['ExpandedProductCard-Similar']}>{similarSlot}</div>
      ) : null}
    </article>
  )
}

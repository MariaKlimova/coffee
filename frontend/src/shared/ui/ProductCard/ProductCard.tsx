import { CART_COPY, FAVORITE_COPY } from '@shared/lib/copy'
import { cx } from '@shared/lib/cx'
import { Badge } from '@shared/ui/Badge'
import { Button } from '@shared/ui/Button'
import { HeartIcon } from '@shared/ui/icons'
import { ImageCarousel } from '@shared/ui/ImageCarousel'

import type { ProductCardProps } from './ProductCard.typings'
import styles from './ProductCard.module.css'

export function ProductCard({
  id,
  categoryLabel,
  title,
  description,
  images,
  price,
  oldPrice,
  inStock = true,
  isFavorite = false,
  cartQuantity = 0,
  onToggleFavorite,
  onAddToCart,
  onCartQuantityChange,
  onExpand,
  className,
  ...rest
}: ProductCardProps) {
  const showQty = cartQuantity > 0
  const quantityId = `${id}-cart-quantity`

  return (
    <article
      {...rest}
      className={cx(
        styles.ProductCard,
        !inStock && styles['ProductCard--outOfStock'],
        className,
      )}
    >
      <div
        className={styles['ProductCard-Media']}
        onClick={() => {
          onExpand?.(id)
        }}
      >
        <ImageCarousel images={images} alt={title} size="card" />
        {!inStock ? (
          <Badge className={styles['ProductCard-Badge']}>{CART_COPY.outOfStock}</Badge>
        ) : null}
        <button
          type="button"
          className={styles['ProductCard-Favorite']}
          aria-label={isFavorite ? FAVORITE_COPY.remove : FAVORITE_COPY.add}
          aria-pressed={isFavorite}
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite?.(id)
          }}
        >
          <HeartIcon filled={isFavorite} />
        </button>
      </div>

      <div className={styles['ProductCard-Body']}>
        <p className={styles['ProductCard-Category']}>{categoryLabel}</p>
        <h3 className={styles['ProductCard-Title']}>
          {/* Кнопка растянута псевдоэлементом на всю карточку: раскрытие доступно
              и мышью по любому месту, и с клавиатуры одним таб-стопом. */}
          <button
            type="button"
            className={styles['ProductCard-Expand']}
            onClick={() => {
              onExpand?.(id)
            }}
          >
            {title}
          </button>
        </h3>
        {description ? (
          <p className={styles['ProductCard-Description']}>{description}</p>
        ) : null}
        <div className={styles['ProductCard-Footer']}>
          <div className={styles['ProductCard-PriceRow']}>
            {oldPrice ? (
              <span className={styles['ProductCard-OldPrice']}>{oldPrice}</span>
            ) : null}
            <span className={styles['ProductCard-Price']}>{price}</span>
          </div>
          {showQty ? (
            <div
              className={styles['ProductCard-Qty']}
              role="group"
              aria-label={CART_COPY.quantityLabel}
            >
              <button
                type="button"
                className={styles['ProductCard-QtyButton']}
                aria-label={CART_COPY.decreaseQty}
                disabled={!inStock}
                onClick={(event) => {
                  event.stopPropagation()
                  onCartQuantityChange?.(id, cartQuantity - 1)
                }}
              >
                −
              </button>
              <span
                id={quantityId}
                className={styles['ProductCard-QtyValue']}
                aria-live="polite"
              >
                {cartQuantity}
              </span>
              <button
                type="button"
                className={styles['ProductCard-QtyButton']}
                aria-label={CART_COPY.increaseQty}
                disabled={!inStock}
                onClick={(event) => {
                  event.stopPropagation()
                  onCartQuantityChange?.(id, cartQuantity + 1)
                }}
              >
                +
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              className={styles['ProductCard-CartButton']}
              disabled={!inStock}
              onClick={(event) => {
                event.stopPropagation()
                onAddToCart?.(id)
              }}
            >
              {CART_COPY.add}
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

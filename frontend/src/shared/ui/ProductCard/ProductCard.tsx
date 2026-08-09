import { cx } from '@shared/lib/cx'
import { Badge } from '@shared/ui/Badge'
import { Button } from '@shared/ui/Button'
import { ImageCarousel } from '@shared/ui/ImageCarousel'

import type { ProductCardProps } from './ProductCard.typings'
import styles from './ProductCard.module.css'

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 20s-7-4.35-7-9.2A3.8 3.8 0 0 1 12 7.2a3.8 3.8 0 0 1 7 3.6C19 15.65 12 20 12 20Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
  onToggleFavorite,
  onAddToCart,
  onExpand,
  className,
  ...rest
}: ProductCardProps) {
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
          <Badge className={styles['ProductCard-Badge']}>Нет в наличии</Badge>
        ) : null}
        <button
          type="button"
          className={styles['ProductCard-Favorite']}
          aria-label={isFavorite ? 'Убрать из избранного' : 'В избранное'}
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
          <Button
            size="sm"
            className={styles['ProductCard-CartButton']}
            disabled={!inStock}
            onClick={() => {
              onAddToCart?.(id)
            }}
          >
            В корзину
          </Button>
        </div>
      </div>
    </article>
  )
}

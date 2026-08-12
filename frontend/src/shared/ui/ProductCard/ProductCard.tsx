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

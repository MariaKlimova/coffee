import { useEffect } from 'react'

import { cx } from '@shared/lib/cx'
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
    isFavorite = false,
    onToggleFavorite,
    similarSlot,
    className,
    attributes,
    ...rest
  } = props

  const titleId = `${id}-expanded-title`

  useEffect(() => {
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
      className={cx(styles.ExpandedProductCard, className)}
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
              aria-label={isFavorite ? 'Убрать из избранного' : 'В избранное'}
              aria-pressed={isFavorite}
              onClick={() => {
                onToggleFavorite(id)
              }}
            >
              <HeartIcon filled={isFavorite} />
            </button>
          ) : null}
          <button
            type="button"
            className={styles['ExpandedProductCard-Close']}
            aria-label="Закрыть"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
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
        <h2 className={styles['ExpandedProductCard-Title']} id={titleId}>
          {title}
        </h2>
        <p className={styles['ExpandedProductCard-Description']}>{description}</p>
        <div className={styles['ExpandedProductCard-PriceRow']}>
          {oldPrice ? (
            <span className={styles['ExpandedProductCard-OldPrice']}>{oldPrice}</span>
          ) : null}
          <span className={styles['ExpandedProductCard-Price']}>{price}</span>
        </div>

        <p className={styles['ExpandedProductCard-AttrsTitle']}>Характеристики</p>

        {category === 'coffee' ? (
          <>
            <p className={styles['ExpandedProductCard-Origin']}>
              Страна: {attributes.originCountry}
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

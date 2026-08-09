import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from 'react'

import { cx } from '@shared/lib/cx'
import { useCoarsePointer } from '@shared/lib/useCoarsePointer'

import { SWIPE_THRESHOLD_PX } from './ImageCarousel.const'
import type { ImageCarouselProps } from './ImageCarousel.typings'
import styles from './ImageCarousel.module.css'

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ImageCarousel({
  images,
  alt,
  size = 'card',
  className,
  ...rest
}: ImageCarouselProps) {
  const [index, setIndex] = useState(0)
  const [imagesKey, setImagesKey] = useState(() => images.join('|'))
  const nextImagesKey = images.join('|')
  if (imagesKey !== nextImagesKey) {
    setImagesKey(nextImagesKey)
    setIndex(0)
  }
  const isTouch = useCoarsePointer()
  const touchStartX = useRef<number | null>(null)
  const count = images.length
  const hasMultiple = count > 1
  const safeIndex = count === 0 ? 0 : index % count
  const currentSrc = count > 0 ? images[safeIndex] : undefined

  const goPrev = useCallback(() => {
    if (!hasMultiple) {
      return
    }
    setIndex((current) => (current - 1 + count) % count)
  }, [count, hasMultiple])

  const goNext = useCallback(() => {
    if (!hasMultiple) {
      return
    }
    setIndex((current) => (current + 1) % count)
  }, [count, hasMultiple])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goPrev()
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      goNext()
    }
  }

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null
  }

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current
    const endX = event.changedTouches[0]?.clientX
    touchStartX.current = null
    if (startX === null || endX === undefined) {
      return
    }
    const delta = endX - startX
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) {
      return
    }
    if (delta > 0) {
      goPrev()
      return
    }
    goNext()
  }

  return (
    <div
      {...rest}
      className={cx(
        styles.ImageCarousel,
        size === 'expanded' && styles['ImageCarousel--expanded'],
        hasMultiple && styles['ImageCarousel--multi'],
        isTouch && styles['ImageCarousel--touch'],
        className,
      )}
      role="group"
      aria-roledescription="carousel"
      aria-label={alt}
      tabIndex={hasMultiple ? 0 : undefined}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {currentSrc ? (
        <img
          className={styles['ImageCarousel-Slide']}
          src={currentSrc}
          alt={alt}
          draggable={false}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className={styles['ImageCarousel-Placeholder']} aria-hidden />
      )}

      {hasMultiple ? (
        <>
          <button
            type="button"
            className={cx(
              styles['ImageCarousel-Arrow'],
              styles['ImageCarousel-Arrow--prev'],
            )}
            aria-label="Предыдущее фото"
            onClick={(event) => {
              event.stopPropagation()
              goPrev()
            }}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className={cx(
              styles['ImageCarousel-Arrow'],
              styles['ImageCarousel-Arrow--next'],
            )}
            aria-label="Следующее фото"
            onClick={(event) => {
              event.stopPropagation()
              goNext()
            }}
          >
            <ChevronRight />
          </button>
          <ul className={styles['ImageCarousel-Dots']}>
            {images.map((src, dotIndex) => (
              <li key={`${src}-${dotIndex}`}>
                <button
                  type="button"
                  className={cx(
                    styles['ImageCarousel-Dot'],
                    dotIndex === safeIndex && styles['ImageCarousel-Dot--active'],
                  )}
                  aria-label={`Фото ${dotIndex + 1}`}
                  aria-current={dotIndex === safeIndex || undefined}
                  onClick={(event) => {
                    event.stopPropagation()
                    setIndex(dotIndex)
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

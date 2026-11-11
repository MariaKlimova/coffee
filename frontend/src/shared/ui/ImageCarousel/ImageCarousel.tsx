import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from 'react'

import { Link } from 'react-router-dom'

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
  imageHref,
  imageLinkState,
  onImageOpen,
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
  const swiped = useRef(false)
  const touchStart = useRef<{ x: number; y: number; identifier: number } | null>(null)
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
    swiped.current = false
    const touch = event.touches.length === 1 ? event.changedTouches[0] : undefined
    touchStart.current = touch
      ? { x: touch.clientX, y: touch.clientY, identifier: touch.identifier }
      : null
  }

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current
    const end = Array.from(event.changedTouches).find(
      (touch) => touch.identifier === start?.identifier,
    )
    touchStart.current = null
    if (!start || !end) {
      return
    }
    const delta = end.clientX - start.x
    const verticalDelta = end.clientY - start.y
    if (
      Math.abs(delta) < SWIPE_THRESHOLD_PX ||
      Math.abs(delta) <= Math.abs(verticalDelta)
    ) {
      return
    }
    swiped.current = true
    if (delta > 0) {
      goPrev()
      return
    }
    goNext()
  }

  const slide = currentSrc ? (
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
  )

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
      onTouchCancel={() => {
        touchStart.current = null
        swiped.current = false
      }}
    >
      <div className={styles['ImageCarousel-Media']}>
        {imageHref ? (
          <Link
            to={imageHref}
            state={imageLinkState}
            tabIndex={-1}
            aria-label={alt}
            className={styles['ImageCarousel-Link']}
            onClick={(event) => {
              if (swiped.current) {
                event.preventDefault()
                swiped.current = false
                return
              }
              onImageOpen?.()
            }}
          >
            {slide}
          </Link>
        ) : (
          slide
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
          </>
        ) : null}
      </div>
      {hasMultiple ? (
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
      ) : null}
    </div>
  )
}

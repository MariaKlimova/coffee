import type { HTMLAttributes } from 'react'

/**
 * Visual size of the carousel frame.
 */
export type ImageCarouselSize = 'card' | 'expanded'

export interface ImageCarouselProps extends HTMLAttributes<HTMLDivElement> {
  /** Image URLs; empty list shows placeholder only. */
  images: string[]
  /** Accessible label for the current slide. */
  alt: string
  /** Frame size preset. Defaults to card. */
  size?: ImageCarouselSize
}

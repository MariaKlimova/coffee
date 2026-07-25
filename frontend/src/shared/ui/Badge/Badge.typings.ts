import type { HTMLAttributes, ReactNode } from 'react'

/**
 * Visual tone of the badge.
 */
export type BadgeVariant = 'neutral' | 'success' | 'danger'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Visual tone. Defaults to neutral. */
  variant?: BadgeVariant
  /** Badge content. */
  children: ReactNode
}

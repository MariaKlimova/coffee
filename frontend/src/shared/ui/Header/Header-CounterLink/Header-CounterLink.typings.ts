import type { ReactNode } from 'react'

/**
 * Props for a header icon link with a count badge.
 */
export interface HeaderCounterLinkProps {
  /** Destination path. */
  to: string
  /** Accessible name without the count (e.g. «Корзина»). */
  label: string
  /** Numeric count shown in the badge. */
  count: number
  /** Decorative icon. */
  icon: ReactNode
  /** Optional extra class name. */
  className?: string
}

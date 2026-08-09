import type { ReactNode } from 'react'

/**
 * Props for the reusable empty-state block.
 */
export interface EmptyStateProps {
  /** Optional illustration or icon. */
  icon?: ReactNode
  /** Main heading. */
  title: string
  /** Supporting description. */
  description?: string
  /** Optional CTA (usually a Button). */
  action?: ReactNode
  /** Optional extra class name. */
  className?: string
}

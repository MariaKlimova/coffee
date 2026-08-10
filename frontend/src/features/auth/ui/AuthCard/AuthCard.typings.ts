import type { ReactNode } from 'react'

/**
 * Props for the shared auth screen card.
 */
export interface AuthCardProps {
  /** Page heading. */
  title: string
  /** Optional form-level error shown above the form. */
  formError?: string
  /** Form and other content. */
  children: ReactNode
  /** Footer prompt before the navigation link. Omit with other footer props to hide. */
  footerPrompt?: string
  /** Footer link label. */
  footerLinkLabel?: string
  /** Footer link destination. */
  footerTo?: string
  /** Optional extra class name. */
  className?: string
}

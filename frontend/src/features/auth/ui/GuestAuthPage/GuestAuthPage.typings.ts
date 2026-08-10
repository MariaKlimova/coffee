import type { ReactNode } from 'react'

/**
 * Callbacks provided to guest auth page content.
 */
export interface GuestAuthPageRenderProps {
  /** Navigate to the saved redirect path after a successful auth action. */
  onSuccess: () => void
}

/**
 * Props for the guest-only auth page shell.
 */
export interface GuestAuthPageProps {
  /** Auth form (or other guest content) rendered after the session settles. */
  children: (props: GuestAuthPageRenderProps) => ReactNode
  /** Optional extra class name for the page wrapper. */
  className?: string
}

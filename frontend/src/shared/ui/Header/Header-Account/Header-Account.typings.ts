import type { HeaderUser } from '../Header.typings'

/**
 * Props for the header account control.
 */
export interface HeaderAccountProps {
  /** Authenticated user; omit or null for guest state. */
  user?: HeaderUser | null
  /** Logout handler. */
  onLogout?: () => void
  /** Optional extra class name. */
  className?: string
}

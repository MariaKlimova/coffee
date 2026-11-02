import type { HeaderUser } from '../Header.typings'

/**
 * Props for the header account control.
 */
export interface HeaderAccountProps {
  /** Показывать личные покупательские заказы. */
  shoppingEnabled?: boolean
  /** Показывать вход в управление владельцу. */
  managementEnabled?: boolean
  /** Authenticated user; omit or null for guest state. */
  user?: HeaderUser | null
  /** Logout handler. */
  onLogout?: () => void
  /** Optional extra class name. */
  className?: string
}

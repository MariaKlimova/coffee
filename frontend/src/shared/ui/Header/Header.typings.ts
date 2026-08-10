/**
 * Navigation item in the store header.
 */
export interface HeaderNavItem {
  /** Route path. */
  to: string
  /** Visible label. */
  label: string
}

/**
 * Authenticated user shown in the account control.
 */
export interface HeaderUser {
  /** Display name. */
  name: string
}

/**
 * Props for the store header.
 */
export interface HeaderProps {
  /** Favorites badge count. */
  favoritesCount?: number
  /** Cart badge count. */
  cartCount?: number
  /** Authenticated user; omit or null for guest state. */
  user?: HeaderUser | null
  /** Search form submit handler. */
  onSearchSubmit?: (query: string) => void
  /** Logout handler for the account menu. */
  onLogout?: () => void
  /** Optional extra class name. */
  className?: string
}

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
  /** Показывать покупательские действия и навигацию. */
  shoppingEnabled?: boolean
  /** Показывать семантический вход в управление. */
  managementEnabled?: boolean
  /** Favorites badge count. */
  favoritesCount?: number
  /** Cart badge count. */
  cartCount?: number
  /** Authenticated user; omit or null for guest state. */
  user?: HeaderUser | null
  /** Search form submit handler. */
  onSearchSubmit?: (query: string) => void
  /** Применение каждого изменения текста без ожидания отправки формы. */
  onSearchChange?: (query: string) => void
  /** Запрос, сохранённый в URL каталога. */
  searchQuery?: string
  /** Запись истории, при смене которой поле восстанавливается из URL. */
  searchLocationKey?: string
  /** Доступное имя формы с областью поиска. */
  searchScope?: string
  /** Query string поиска для переходов между категориями. */
  catalogSearch?: string
  /** Очистка поискового запроса в каталоге. */
  onSearchClear?: () => void
  /** Logout handler for the account menu. */
  onLogout?: () => void
  /** Optional extra class name. */
  className?: string
}

export interface HeaderNavigationProps {
  /** Показывать покупательские разделы. */
  shoppingEnabled?: boolean
  /** Показывать управление каталогом. */
  managementEnabled?: boolean
  /** Query string применённого поиска для переходов между категориями. */
  catalogSearch?: string
}

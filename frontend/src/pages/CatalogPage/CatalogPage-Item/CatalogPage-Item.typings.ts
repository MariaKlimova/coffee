import type { ProductListItem } from '@entities/product'

export interface CatalogPageItemProps {
  /** Товар из списка каталога. */
  product: ProductListItem
  /** Ссылка на отдельную страницу товара. */
  href: string
  /** Состояние возврата в каталог. */
  linkState: unknown
  /** Сохраняет положение каталога перед переходом. */
  onOpen: () => void
}

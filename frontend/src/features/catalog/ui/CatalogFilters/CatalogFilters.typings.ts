import type { ProductOrdering } from '@entities/product'

import type { CatalogFilterPatch } from '../../lib/catalogSearchParams.typings'

/** Параметры фильтров, применённые к каталогу. */
export interface CatalogFiltersProps {
  /** Нижняя граница цены из URL. */
  priceMin?: string
  /** Верхняя граница цены из URL. */
  priceMax?: string
  /** Показывать только товары в наличии. */
  inStockOnly: boolean
  /** Применённая сортировка. */
  ordering: ProductOrdering
  /** Применить параметры и сбросить страницу. */
  onChange: (patch: CatalogFilterPatch) => void
  /** Ключ навигации: закрывает черновик при переходе по истории. */
  navigationKey?: string
  /** Дополнительный класс. */
  className?: string
}

import type { ProductOrdering } from '@entities/product'

/**
 * User-facing copy for the catalog storefront.
 */
export const CATALOG_COPY = {
  filtersLabel: 'Фильтры',
  priceFromLabel: 'Цена от',
  priceToLabel: 'Цена до',
  inStockOnlyLabel: 'Только в наличии',
  sortingLabel: 'Сортировка',
  emptyTitle: 'Ничего не нашлось',
  emptyDescription: 'Попробуй изменить фильтры или сбросить их',
  resetFilters: 'Сбросить фильтры',
  errorTitle: 'Не удалось загрузить каталог',
  errorDescription: 'Проверь соединение и попробуй ещё раз',
  detailErrorTitle: 'Не удалось открыть товар',
  detailErrorDescription: 'Проверь соединение и попробуй ещё раз',
  retry: 'Попробовать ещё раз',
  close: 'Закрыть',
  paginationLabel: 'Страницы каталога',
  previousPage: 'Назад',
  nextPage: 'Вперёд',
  loadingLabel: 'Загрузка каталога',
  similarTitle: 'Похожие товары',
  similarStripLabel: 'Лента похожих товаров',
  filtersResetToast: 'Сбросили фильтры, чтобы показать товар',
  similarNotFoundToast: 'Не нашли такой товар',
  similarOpenErrorToast: 'Не удалось открыть товар',
} as const

/**
 * Sort options shown in the catalog Select.
 */
export const SORT_OPTIONS: Array<{
  /** Ordering value sent to the API. */
  value: ProductOrdering
  /** Visible label. */
  label: string
}> = [
  { value: '-created_at', label: 'Сначала новинки' },
  { value: 'price', label: 'Сначала дешёвые' },
  { value: '-price', label: 'Сначала дорогие' },
]

/**
 * Default ordering when the URL has no `ordering` param.
 */
export const DEFAULT_ORDERING: ProductOrdering = '-created_at'

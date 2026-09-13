import { CLOSE, RETRY } from './phrases'

/**
 * Пользовательские строки витрины каталога.
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
  retry: RETRY,
  close: CLOSE,
  paginationLabel: 'Страницы каталога',
  previousPage: 'Назад',
  nextPage: 'Вперёд',
  loadingLabel: 'Загрузка каталога',
  similarTitle: 'Похожие товары',
  similarStripLabel: 'Лента похожих товаров',
  filtersResetToast: 'Сбросили фильтры, чтобы показать товар',
  similarNotFoundToast: 'Не нашли такой товар',
  similarOpenErrorToast: 'Не удалось открыть товар',
  sortNewest: 'Сначала новинки',
  sortCheapest: 'Сначала дешёвые',
  sortPriceDesc: 'Сначала дорогие',
} as const

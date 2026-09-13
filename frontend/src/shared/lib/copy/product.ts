import { BACK_TO_CATALOG } from './phrases'

/**
 * Строки состояний deep-link резолвера товара.
 */
export const PRODUCT_PAGE_COPY = {
  loadingLabel: 'Открываем товар',
  notFoundTitle: 'Не нашли такой товар',
  notFoundDescription:
    'Возможно, ссылка устарела — посмотри, что есть в каталоге',
  backToCatalog: BACK_TO_CATALOG,
} as const

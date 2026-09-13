import { GO_TO_CATALOG, RETRY } from './phrases'

/**
 * Пользовательские строки для действий с корзиной (product-voice, glossary).
 */
export const CART_COPY = {
  /** Короткий CTA на карточке товара. */
  add: 'В корзину',
  /** CTA на развёрнутой карточке с выбором количества. */
  addCta: 'Добавить в корзину',
  added: 'Добавлено в корзину',
  error: 'Не удалось добавить в корзину. Попробуй ещё раз',
  decreaseQty: 'Уменьшить количество',
  increaseQty: 'Увеличить количество',
  quantityLabel: 'Количество',
  outOfStock: 'Нет в наличии',
} as const

/**
 * Пользовательские строки страницы корзины.
 */
export const CART_PAGE_COPY = {
  title: 'Корзина',
  emptyTitle: 'Корзина пока пуста',
  emptyDescription: 'Загляни в каталог — выбери то, что хочется попробовать',
  goToCatalog: GO_TO_CATALOG,
  checkout: 'Оформить заказ',
  remove: 'Удалить',
  total: 'Итого',
  errorTitle: 'Не удалось загрузить корзину',
  loadingLabel: 'Загрузка корзины',
  retry: RETRY,
} as const

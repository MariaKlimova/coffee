import { GO_TO_CATALOG, LOAD_ORDER_ERROR, RETRY } from './phrases'

/**
 * Подписи статусов заказа (product-voice).
 */
export const ORDER_STATUS_COPY = {
  /** Ожидает оплаты. */
  pending: 'Ожидает оплаты',
  /** В обработке. */
  processing: 'В обработке',
  /** Оплачен. */
  paid: 'Оплачен',
  /** Отправлен. */
  shipped: 'Отправлен',
  /** Доставлен. */
  delivered: 'Доставлен',
  /** Отменён. */
  cancelled: 'Отменён',
  /** Неизвестный статус с API. */
  unknown: 'Неизвестный статус',
} as const

/**
 * Пользовательские строки страницы «Мои заказы».
 */
export const ORDERS_PAGE_COPY = {
  /** Заголовок страницы списка. */
  title: 'Мои заказы',
  /** Пустой список. */
  emptyTitle: 'Заказов пока нет',
  /** Подсказка при пустом списке. */
  emptyDescription: 'Когда оформишь первый — он появится здесь',
  /** CTA в каталог. */
  goToCatalog: GO_TO_CATALOG,
  /** Ошибка загрузки списка. */
  errorTitle: 'Не удалось загрузить заказы',
  /** Aria при загрузке. */
  loadingLabel: 'Загрузка заказов',
  /** Повтор загрузки. */
  retry: RETRY,
  /** Шаблон номера в списке; `{id}` — UUID. */
  orderNumber: 'Заказ {id}',
} as const

/**
 * Пользовательские строки деталки заказа.
 */
export const ORDER_DETAIL_COPY = {
  /** Заголовок; `{id}` — UUID. */
  title: 'Заказ {id}',
  /** Секция позиций. */
  itemsTitle: 'Состав заказа',
  /** Подпись адреса. */
  addressLabel: 'Адрес доставки',
  /** Итоговая сумма. */
  totalLabel: 'Итого',
  /** Количество в позиции; `{count}` — число. */
  quantity: '{count} шт.',
  /** 1 позиция; `{count}` — число. */
  itemsCountOne: '{count} позиция',
  /** 2–4 позиции; `{count}` — число. */
  itemsCountFew: '{count} позиции',
  /** 5+ позиций; `{count}` — число. */
  itemsCountMany: '{count} позиций',
  /** Назад к списку. */
  backToOrders: 'Назад к заказам',
  /** Заказ не найден / нет доступа. */
  notFoundTitle: 'Не нашли такой заказ',
  /** Подсказка при 404. */
  notFoundDescription: 'Возможно, ссылка устарела — посмотри список заказов',
  /** Ошибка загрузки. */
  errorTitle: LOAD_ORDER_ERROR,
  /** Aria при загрузке. */
  loadingLabel: 'Загрузка заказа',
  /** Повтор. */
  retry: RETRY,
  /** Оплатить pending/cancelled заказ. */
  pay: 'Оплатить',
  /** Пока идёт создание платёжной сессии. */
  paying: 'Переходим к оплате',
} as const

import { GO_TO_CATALOG, RETRY } from './phrases'

/**
 * Пользовательские строки избранного (toggle и связанный UI).
 */
export const FAVORITE_COPY = {
  guestHint: 'Войди, чтобы добавить в избранное',
  error: 'Не удалось обновить избранное. Попробуй ещё раз',
  add: 'В избранное',
  remove: 'Убрать из избранного',
} as const

/**
 * Пользовательские строки страницы избранного.
 */
export const FAVORITES_PAGE_COPY = {
  title: 'Избранное',
  emptyTitle: 'Здесь пока пусто',
  emptyDescription: 'Отмечай сердечком то, что понравилось — вернёшься к этому позже',
  goToCatalog: GO_TO_CATALOG,
  errorTitle: 'Не удалось загрузить избранное',
  loadingLabel: 'Загрузка избранного',
  retry: RETRY,
} as const

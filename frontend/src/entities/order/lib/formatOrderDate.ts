const orderDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Форматирует ISO-дату заказа для UI (например «19 сентября 2026»).
 */
export function formatOrderDate(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }
  return orderDateFormatter.format(date)
}

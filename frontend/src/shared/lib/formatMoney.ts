const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/**
 * Formats an API Money string (e.g. `"1290.00"`) as a RUB label for UI.
 * Uses a non-breaking space before the currency sign.
 */
export function formatMoney(value: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return value
  }
  return `${moneyFormatter.format(amount)}\u00A0₽`
}

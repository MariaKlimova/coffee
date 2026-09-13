import type { CartItem } from '@entities/cart'

/**
 * Суммирует `line_total` только по позициям в наличии.
 */
export function sumAvailableLineTotals(items: CartItem[]): string {
  const total = items.reduce((sum, item) => {
    if (!item.product.in_stock) {
      return sum
    }
    const amount = Number.parseFloat(item.line_total)
    if (!Number.isFinite(amount)) {
      return sum
    }
    return sum + amount
  }, 0)

  return total.toFixed(2)
}

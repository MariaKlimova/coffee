/**
 * Props блока итога корзины.
 */
export interface CartPageSummaryProps {
  /** Итоговая сумма (уже отформатированная или raw money — формат внутри). */
  total: string
  /** Есть ли позиции в наличии для оформления. */
  canCheckout: boolean
}

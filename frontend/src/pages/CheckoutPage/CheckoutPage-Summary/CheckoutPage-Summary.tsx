import { CHECKOUT_COPY } from '@shared/lib/copy'
import { formatMoney } from '@shared/lib/formatMoney'

import { CheckoutPageLine } from '../CheckoutPage-Line'
import type { CheckoutPageSummaryProps } from './CheckoutPage-Summary.typings'
import styles from './CheckoutPage-Summary.module.css'

/**
 * Краткая сводка позиций корзины и итог перед оплатой.
 */
export function CheckoutPageSummary({ items, total }: CheckoutPageSummaryProps) {
  return (
    <aside
      className={styles['CheckoutPage-Summary']}
      aria-label={CHECKOUT_COPY.summaryLabel}
    >
      <h2 className={styles['CheckoutPage-Summary-Title']}>
        {CHECKOUT_COPY.summaryLabel}
      </h2>
      <ul className={styles['CheckoutPage-Summary-List']}>
        {items.map((item) => (
          <CheckoutPageLine key={item.id} item={item} />
        ))}
      </ul>
      <div className={styles['CheckoutPage-Summary-Row']}>
        <p className={styles['CheckoutPage-Summary-Label']}>{CHECKOUT_COPY.total}</p>
        <p className={styles['CheckoutPage-Summary-Total']}>{formatMoney(total)}</p>
      </div>
    </aside>
  )
}

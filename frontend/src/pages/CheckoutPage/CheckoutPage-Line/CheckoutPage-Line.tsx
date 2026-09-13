import { CART_COPY, CHECKOUT_COPY } from '@shared/lib/copy'
import { cx } from '@shared/lib/cx'
import { formatMoney } from '@shared/lib/formatMoney'

import type { CheckoutPageLineProps } from './CheckoutPage-Line.typings'
import styles from './CheckoutPage-Line.module.css'

/**
 * Строка сводки: название, количество, сумма позиции.
 */
export function CheckoutPageLine({ item }: CheckoutPageLineProps) {
  const inStock = item.product.in_stock

  return (
    <li
      className={cx(
        styles['CheckoutPage-Line'],
        !inStock && styles['CheckoutPage-Line--outOfStock'],
      )}
    >
      <div>
        <p className={styles['CheckoutPage-Line-Name']}>{item.product.name}</p>
        <p className={styles['CheckoutPage-Line-Meta']}>
          {item.quantity} {CHECKOUT_COPY.quantity}
          {!inStock ? ` · ${CART_COPY.outOfStock}` : null}
        </p>
      </div>
      <p className={styles['CheckoutPage-Line-Total']}>
        {formatMoney(item.line_total)}
      </p>
    </li>
  )
}

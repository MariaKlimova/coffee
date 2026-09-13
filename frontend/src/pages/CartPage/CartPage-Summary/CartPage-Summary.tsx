import { APP_ROUTES } from '@shared/config/routes'
import { CART_PAGE_COPY } from '@shared/lib/copy'
import { formatMoney } from '@shared/lib/formatMoney'
import { Button } from '@shared/ui'

import type { CartPageSummaryProps } from './CartPage-Summary.typings'
import styles from './CartPage-Summary.module.css'

/**
 * Итог корзины и переход к оформлению заказа.
 */
export function CartPageSummary({ total, canCheckout }: CartPageSummaryProps) {
  return (
    <aside className={styles['CartPage-Summary']} aria-label={CART_PAGE_COPY.total}>
      <div className={styles['CartPage-Summary-Row']}>
        <p className={styles['CartPage-Summary-Label']}>{CART_PAGE_COPY.total}</p>
        <p className={styles['CartPage-Summary-Total']}>{formatMoney(total)}</p>
      </div>
      <Button
        className={styles['CartPage-Summary-Checkout']}
        to={APP_ROUTES.checkout}
        disabled={!canCheckout}
      >
        {CART_PAGE_COPY.checkout}
      </Button>
    </aside>
  )
}

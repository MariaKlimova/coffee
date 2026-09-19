import { ORDER_DETAIL_COPY } from '@shared/lib/copy'
import { formatMoney } from '@shared/lib/formatMoney'

import type { OrderDetailPageLineProps } from './OrderDetailPage-Line.typings'
import styles from './OrderDetailPage-Line.module.css'

/**
 * Позиция заказа: снимок названия, цены и количества.
 */
export function OrderDetailPageLine({ item }: OrderDetailPageLineProps) {
  const quantityLabel = ORDER_DETAIL_COPY.quantity.replace(
    '{count}',
    String(item.quantity),
  )

  return (
    <li className={styles['OrderDetailPage-Line']}>
      <div className={styles['OrderDetailPage-Line-Body']}>
        <p className={styles['OrderDetailPage-Line-Name']}>{item.product_name}</p>
        <p className={styles['OrderDetailPage-Line-Meta']}>{quantityLabel}</p>
      </div>
      <p className={styles['OrderDetailPage-Line-Price']}>
        {formatMoney(item.product_price)}
      </p>
    </li>
  )
}

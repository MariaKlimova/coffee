import { Link } from 'react-router-dom'

import {
  formatOrderDate,
  formatOrderNumberLabel,
  getOrderStatusBadgeVariant,
  getOrderStatusLabel,
} from '@entities/order'
import { orderDetailPath } from '@shared/config'
import { ORDERS_PAGE_COPY } from '@shared/lib/copy'
import { formatMoney } from '@shared/lib/formatMoney'
import { Badge } from '@shared/ui'

import type { OrdersPageItemProps } from './OrdersPage-Item.typings'
import styles from './OrdersPage-Item.module.css'

/**
 * Строка списка заказов со ссылкой на деталку.
 */
export function OrdersPageItem({ order }: OrdersPageItemProps) {
  return (
    <Link
      to={orderDetailPath(order.id)}
      className={styles['OrdersPage-Item']}
    >
      <div className={styles['OrdersPage-Item-Main']}>
        <span className={styles['OrdersPage-Item-Number']}>
          {formatOrderNumberLabel(ORDERS_PAGE_COPY.orderNumber, order.id)}
        </span>
        <time
          className={styles['OrdersPage-Item-Date']}
          dateTime={order.created_at}
        >
          {formatOrderDate(order.created_at)}
        </time>
      </div>
      <span className={styles['OrdersPage-Item-Status']}>
        <Badge variant={getOrderStatusBadgeVariant(order.status)}>
          {getOrderStatusLabel(order.status)}
        </Badge>
      </span>
      <span className={styles['OrdersPage-Item-Total']}>
        {formatMoney(order.total)}
      </span>
    </Link>
  )
}

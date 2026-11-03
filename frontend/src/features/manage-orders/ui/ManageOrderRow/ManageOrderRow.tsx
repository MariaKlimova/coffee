import { Link } from 'react-router-dom'

import { getOrderStatusBadgeVariant, getOrderStatusLabel } from '@entities/order'
import { APP_ROUTES } from '@shared/config'
import { MANAGE_ORDERS_COPY } from '@shared/lib/copy'
import { Badge } from '@shared/ui/Badge'

import {
  formatManageOrderDate,
  formatManageMoney,
  paymentLabel,
} from '../../lib/orderDisplay'
import type { ManageOrderRowProps } from './ManageOrderRow.typings'
import styles from './ManageOrderRow.module.css'

export function ManageOrderRow({ order, search }: ManageOrderRowProps) {
  return (
    <li className={styles.ManageOrderRow}>
      <div className={styles['ManageOrderRow-Identity']}>
        <Link
          className={styles['ManageOrderRow-Link']}
          to={`${APP_ROUTES.manageOrders}/${encodeURIComponent(order.id)}${search}`}
        >
          {MANAGE_ORDERS_COPY.number(order.id)}
        </Link>
        <time dateTime={order.created_at}>
          {formatManageOrderDate(order.created_at)}
        </time>
      </div>
      <div className={styles['ManageOrderRow-Contact']}>
        {order.customer_email && <span>{order.customer_email}</span>}
        {order.customer_phone && <span>{order.customer_phone}</span>}
        {!order.customer_email && !order.customer_phone && (
          <span>{MANAGE_ORDERS_COPY.noContact}</span>
        )}
      </div>
      <div className={styles['ManageOrderRow-Status']}>
        <Badge variant={getOrderStatusBadgeVariant(order.status)}>
          {getOrderStatusLabel(order.status)}
        </Badge>
        <span>
          {MANAGE_ORDERS_COPY.payment}: {paymentLabel(order.latest_payment_status)}
        </span>
      </div>
      <strong className={styles['ManageOrderRow-Total']}>
        {formatManageMoney(order.total)}
      </strong>
    </li>
  )
}

import { useId } from 'react'

import { getOrderStatusLabel } from '@entities/order'
import { MANAGE_ORDERS_COPY as copy } from '@shared/lib/copy'

import { formatManageOrderDate } from '../../lib/orderDisplay'
import type { ManageOrderHistoryProps } from './ManageOrderHistory.typings'
import styles from './ManageOrderHistory.module.css'

const sources = {
  staff: copy.sourceStaff,
  payment: copy.sourcePayment,
  reservation_expiry: copy.sourceExpiry,
}

export function ManageOrderHistory({ entries }: ManageOrderHistoryProps) {
  const titleId = useId()
  return (
    <section className={styles.ManageOrderHistory} aria-labelledby={titleId}>
      <h2 id={titleId}>{copy.history}</h2>
      {entries.length === 0 && <p>{copy.emptyHistory}</p>}
      <ol className={styles['ManageOrderHistory-List']}>
        {entries.map((entry) => (
          <li key={entry.id} className={styles['ManageOrderHistory-Event']}>
            <strong>
              {copy.confirmStatus(
                getOrderStatusLabel(entry.from_status),
                getOrderStatusLabel(entry.to_status),
              )}
            </strong>
            <time dateTime={entry.created_at}>
              {formatManageOrderDate(entry.created_at)}
            </time>
            <p className={styles['ManageOrderHistory-Source']}>
              {entry.actor?.label || sources[entry.source]}
            </p>
            {entry.comment && <p>{entry.comment}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}

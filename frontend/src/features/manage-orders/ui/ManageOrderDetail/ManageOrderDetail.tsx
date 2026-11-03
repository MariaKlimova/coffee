import { isAxiosError } from 'axios'
import { useParams, useSearchParams } from 'react-router-dom'

import { getOrderStatusBadgeVariant, getOrderStatusLabel } from '@entities/order'
import { isNotFoundError } from '@shared/api'
import { APP_ROUTES } from '@shared/config'
import { MANAGE_COPY, MANAGE_ORDERS_COPY } from '@shared/lib/copy'
import { Badge } from '@shared/ui/Badge'
import { Button } from '@shared/ui/Button'
import { EmptyState } from '@shared/ui/EmptyState'

import {
  formatManageOrderDate,
  formatManageMoney,
  paymentLabel,
} from '../../lib/orderDisplay'
import { orderFilterParams, readOrderFilters } from '../../model/orderFilters'
import { useManageOrder } from '../../model/useManageOrders'
import styles from './ManageOrderDetail.module.css'

export function ManageOrderDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const backSearch = orderFilterParams(readOrderFilters(params).filters).toString()
  const backTo = `${APP_ROUTES.manageOrders}${backSearch ? `?${backSearch}` : ''}`
  const query = useManageOrder(id)
  const order = query.data
  const notFound = !id || isNotFoundError(query.error)
  const denied = isAxiosError(query.error) && query.error.response?.status === 403
  let title = MANAGE_ORDERS_COPY.error as string
  let description = MANAGE_ORDERS_COPY.errorDescription as string
  if (notFound) {
    title = MANAGE_ORDERS_COPY.notFound
    description = MANAGE_ORDERS_COPY.notFoundDescription
  } else if (denied) {
    title = MANAGE_COPY.deniedTitle
    description = MANAGE_COPY.deniedDescription
  }
  return (
    <section className={styles.ManageOrderDetail}>
      <div>
        <Button to={backTo} variant="ghost">
          {MANAGE_ORDERS_COPY.back}
        </Button>
      </div>
      {(notFound || query.isError) && (
        <EmptyState
          title={title}
          description={description}
          action={
            !notFound &&
            !denied && (
              <Button
                onClick={() => {
                  void query.refetch()
                }}
              >
                {MANAGE_ORDERS_COPY.retry}
              </Button>
            )
          }
        />
      )}
      {!notFound && query.isPending && (
        <p role="status">{MANAGE_ORDERS_COPY.loading}</p>
      )}
      {!notFound && !query.isError && order && (
        <>
          <header className={styles['ManageOrderDetail-Header']}>
            <h1>{MANAGE_ORDERS_COPY.number(order.id)}</h1>
            <Badge variant={getOrderStatusBadgeVariant(order.status)}>
              {getOrderStatusLabel(order.status)}
            </Badge>
            <p>
              {MANAGE_ORDERS_COPY.created}:{' '}
              <time dateTime={order.created_at}>
                {formatManageOrderDate(order.created_at)}
              </time>
            </p>
            <p>
              {MANAGE_ORDERS_COPY.updated}:{' '}
              <time dateTime={order.updated_at}>
                {formatManageOrderDate(order.updated_at)}
              </time>
            </p>
          </header>
          <div className={styles['ManageOrderDetail-Columns']}>
            <section className={styles['ManageOrderDetail-Section']}>
              <h2>{MANAGE_ORDERS_COPY.items}</h2>
              <p className={styles['ManageOrderDetail-Hint']}>
                {MANAGE_ORDERS_COPY.historyHint}
              </p>
              {order.items.length === 0 && <p>{MANAGE_ORDERS_COPY.noItems}</p>}
              <ul className={styles['ManageOrderDetail-List']}>
                {order.items.map((item) => (
                  <li key={item.id} className={styles['ManageOrderDetail-Line']}>
                    <strong>{item.product_name}</strong>
                    <span>
                      {MANAGE_ORDERS_COPY.itemPrice(
                        formatManageMoney(item.product_price),
                        item.quantity,
                      )}
                    </span>
                    {item.product_id === null && (
                      <p className={styles['ManageOrderDetail-Hint']}>
                        {MANAGE_ORDERS_COPY.deletedProduct}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className={styles['ManageOrderDetail-Total']}>
                {MANAGE_ORDERS_COPY.total}:{' '}
                <strong>{formatManageMoney(order.total)}</strong>
              </p>
            </section>
            <div className={styles['ManageOrderDetail-Stack']}>
              <section className={styles['ManageOrderDetail-Section']}>
                <h2>{MANAGE_ORDERS_COPY.contact}</h2>
                {order.customer_email && <p>{order.customer_email}</p>}
                {order.customer_phone && <p>{order.customer_phone}</p>}
                {!order.customer_email && !order.customer_phone && (
                  <p>{MANAGE_ORDERS_COPY.noContact}</p>
                )}
                <p className={styles['ManageOrderDetail-Hint']}>
                  {MANAGE_ORDERS_COPY.contactHint}
                </p>
              </section>
              <section className={styles['ManageOrderDetail-Section']}>
                <h2>{MANAGE_ORDERS_COPY.address}</h2>
                <p className={styles['ManageOrderDetail-Address']}>
                  {order.delivery_address || MANAGE_ORDERS_COPY.noAddress}
                </p>
              </section>
            </div>
          </div>
          <section className={styles['ManageOrderDetail-Section']}>
            <h2>{MANAGE_ORDERS_COPY.attempts}</h2>
            {order.payments.length === 0 && <p>{MANAGE_ORDERS_COPY.noPayment}</p>}
            <ul className={styles['ManageOrderDetail-List']}>
              {order.payments.map((payment) => (
                <li key={payment.id} className={styles['ManageOrderDetail-Line']}>
                  <strong>{MANAGE_ORDERS_COPY.attempt(payment.id)}</strong>
                  <Badge
                    variant={payment.status === 'succeeded' ? 'success' : 'neutral'}
                  >
                    {paymentLabel(payment.status)}
                  </Badge>
                  <span>{formatManageMoney(payment.amount)}</span>
                  <span>
                    {MANAGE_ORDERS_COPY.created}:{' '}
                    <time dateTime={payment.created_at}>
                      {formatManageOrderDate(payment.created_at)}
                    </time>
                  </span>
                  <span>
                    {MANAGE_ORDERS_COPY.updated}:{' '}
                    <time dateTime={payment.updated_at}>
                      {formatManageOrderDate(payment.updated_at)}
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <p className={styles['ManageOrderDetail-Hint']}>
            {MANAGE_ORDERS_COPY.readOnly}
          </p>
        </>
      )}
    </section>
  )
}

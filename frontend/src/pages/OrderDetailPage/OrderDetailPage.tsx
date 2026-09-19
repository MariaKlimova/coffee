import { isAxiosError } from 'axios'
import { useParams } from 'react-router-dom'

import {
  formatOrderDate,
  formatOrderItemsCount,
  formatOrderNumberLabel,
  getOrderStatusBadgeVariant,
  getOrderStatusLabel,
  useOrder,
} from '@entities/order'
import { usePayOrder } from '@features/checkout'
import { APP_ROUTES } from '@shared/config'
import { ORDER_DETAIL_COPY } from '@shared/lib/copy'
import { formatMoney } from '@shared/lib/formatMoney'
import { Badge, Button, EmptyState } from '@shared/ui'

import { OrderDetailPageLine } from './OrderDetailPage-Line'
import styles from './OrderDetailPage.module.css'

function isNotFoundError(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404
}

function canPayOrder(status: string): boolean {
  return status === 'pending' || status === 'cancelled'
}

/**
 * Деталка заказа: снимок позиций, адрес и статус.
 */
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const orderId = id ?? null
  const orderQuery = useOrder(orderId)
  const order = orderQuery.data
  const { payOrder, isPaying, error: paymentError } = usePayOrder()

  if (!orderId) {
    return (
      <section className={styles.OrderDetailPage}>
        <EmptyState
          title={ORDER_DETAIL_COPY.notFoundTitle}
          description={ORDER_DETAIL_COPY.notFoundDescription}
          action={
            <Button to={APP_ROUTES.orders}>{ORDER_DETAIL_COPY.backToOrders}</Button>
          }
        />
      </section>
    )
  }

  if (orderQuery.isError) {
    const notFound = isNotFoundError(orderQuery.error)
    return (
      <section className={styles.OrderDetailPage}>
        <EmptyState
          title={
            notFound ? ORDER_DETAIL_COPY.notFoundTitle : ORDER_DETAIL_COPY.errorTitle
          }
          description={notFound ? ORDER_DETAIL_COPY.notFoundDescription : undefined}
          action={
            notFound ? (
              <Button to={APP_ROUTES.orders}>{ORDER_DETAIL_COPY.backToOrders}</Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  void orderQuery.refetch()
                }}
              >
                {ORDER_DETAIL_COPY.retry}
              </Button>
            )
          }
        />
      </section>
    )
  }

  if (orderQuery.isPending || !order) {
    return (
      <section className={styles.OrderDetailPage}>
        <div
          className={styles['OrderDetailPage-Skeleton']}
          role="status"
          aria-live="polite"
          aria-label={ORDER_DETAIL_COPY.loadingLabel}
        >
          <div className={styles['OrderDetailPage-SkeletonBlock']} />
          <div className={styles['OrderDetailPage-SkeletonBlock']} />
        </div>
      </section>
    )
  }

  const itemsCountLabel = formatOrderItemsCount(order.items.length)
  const showPay = canPayOrder(order.status)

  return (
    <section className={styles.OrderDetailPage}>
      <div className={styles['OrderDetailPage-Header']}>
        <Button to={APP_ROUTES.orders} variant="ghost">
          {ORDER_DETAIL_COPY.backToOrders}
        </Button>
        <div className={styles['OrderDetailPage-TitleRow']}>
          <h1 className={styles['OrderDetailPage-Title']}>
            {formatOrderNumberLabel(ORDER_DETAIL_COPY.title, order.id)}
          </h1>
          <Badge variant={getOrderStatusBadgeVariant(order.status)}>
            {getOrderStatusLabel(order.status)}
          </Badge>
        </div>
        <time className={styles['OrderDetailPage-Date']} dateTime={order.created_at}>
          {formatOrderDate(order.created_at)}
        </time>
      </div>

      <div className={styles['OrderDetailPage-Section']}>
        <h2 className={styles['OrderDetailPage-SectionTitle']}>
          {ORDER_DETAIL_COPY.itemsTitle}
        </h2>
        <p className={styles['OrderDetailPage-ItemsCount']}>{itemsCountLabel}</p>
        <ul className={styles['OrderDetailPage-List']}>
          {order.items.map((item) => (
            <OrderDetailPageLine key={item.id} item={item} />
          ))}
        </ul>
        <div className={styles['OrderDetailPage-TotalRow']}>
          <p className={styles['OrderDetailPage-TotalLabel']}>
            {ORDER_DETAIL_COPY.totalLabel}
          </p>
          <p className={styles['OrderDetailPage-TotalValue']}>
            {formatMoney(order.total)}
          </p>
        </div>
      </div>

      <div className={styles['OrderDetailPage-Section']}>
        <h2 className={styles['OrderDetailPage-SectionTitle']}>
          {ORDER_DETAIL_COPY.addressLabel}
        </h2>
        <p className={styles['OrderDetailPage-Address']}>{order.delivery_address}</p>
      </div>

      {showPay ? (
        <div className={styles['OrderDetailPage-Pay']}>
          <Button
            type="button"
            loading={isPaying}
            onClick={() => {
              void payOrder(order.id)
            }}
          >
            {isPaying ? ORDER_DETAIL_COPY.paying : ORDER_DETAIL_COPY.pay}
          </Button>
          {paymentError ? (
            <p className={styles['OrderDetailPage-PayError']} role="alert">
              {paymentError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

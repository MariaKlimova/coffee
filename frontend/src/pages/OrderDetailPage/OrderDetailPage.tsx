import { isAxiosError } from 'axios'
import { useParams } from 'react-router-dom'

import {
  formatOrderDate,
  formatOrderItemsCount,
  formatOrderNumberLabel,
  getOrderStatusBadgeVariant,
  getOrderStatusLabel,
} from '@entities/order'
import { useAuthStore } from '@entities/user'
import { usePayOrder } from '@features/checkout'
import { BuyerOrderActions, useBuyerOrder } from '@features/order-cancellation'
import { APP_ROUTES } from '@shared/config'
import { GO_TO_CATALOG, ORDER_DETAIL_COPY } from '@shared/lib/copy'
import { formatMoney } from '@shared/lib/formatMoney'
import { Badge, Button, EmptyState } from '@shared/ui'

import { OrderDetailPageLine } from './OrderDetailPage-Line'
import styles from './OrderDetailPage.module.css'

function canPayOrder(status: string): boolean {
  return status === 'pending'
}

/**
 * Деталка заказа: снимок позиций, адрес и статус.
 */
function OrderDetailPageContent() {
  const { id } = useParams<{ id: string }>()
  const orderId = id ?? null
  const orderQuery = useBuyerOrder(orderId ?? '')
  const order = orderQuery.data?.order
  const isGuest = useAuthStore((state) => state.status === 'guest')
  const backTo = isGuest ? APP_ROUTES.coffee : APP_ROUTES.orders
  const backLabel = isGuest ? GO_TO_CATALOG : ORDER_DETAIL_COPY.backToOrders
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

  if (
    !orderQuery.ready ||
    (isAxiosError(orderQuery.error) &&
      [401, 403, 404].includes(orderQuery.error.response?.status ?? 0))
  )
    return (
      <section className={styles.OrderDetailPage}>
        <Button to={backTo} variant="ghost">
          {backLabel}
        </Button>
        <BuyerOrderActions key={orderQuery.scope} id={orderId} buyer={orderQuery} />
      </section>
    )

  if (orderQuery.isError && !order) {
    return (
      <section className={styles.OrderDetailPage}>
        <EmptyState
          title={ORDER_DETAIL_COPY.errorTitle}
          action={
            <Button
              type="button"
              onClick={() => {
                void orderQuery.refetch()
              }}
            >
              {ORDER_DETAIL_COPY.retry}
            </Button>
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
        <Button to={backTo} variant="ghost">
          {backLabel}
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
        {order.status === 'cancelled' ? (
          <p className={styles['OrderDetailPage-CancellationNote']}>
            {ORDER_DETAIL_COPY.cancelledDescription}
          </p>
        ) : null}
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

      <BuyerOrderActions key={orderQuery.scope} id={order.id} buyer={orderQuery} />

      {showPay && orderQuery.data?.allowed_actions.includes('cancel') ? (
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

/** Смена покупателя сбрасывает локальные формы и незавершённые сетевые состояния. */
export function OrderDetailPage() {
  const status = useAuthStore((state) => state.status)
  const generation = useAuthStore((state) => state.sessionGeneration)
  const userId = useAuthStore((state) => state.user?.id)
  return <OrderDetailPageContent key={`${status}:${generation}:${userId ?? 'guest'}`} />
}

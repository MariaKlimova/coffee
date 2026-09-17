import { selectIsAuthenticated, useAuthStore } from '@entities/user'
import { useOrderPaymentResult } from '@features/checkout'
import { APP_ROUTES } from '@shared/config/routes'
import { ORDER_RESULT_COPY } from '@shared/lib/copy'
import { Button, EmptyState } from '@shared/ui'

import { formatOrderNumberLabel, ORDERS_HREF } from './CheckoutResultPage.const'
import styles from './CheckoutResultPage.module.css'

/**
 * Результат оплаты после возврата с ЮKassa: успех, ожидание, задержка или ошибка.
 */
export function CheckoutResultPage() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const { order, view, isRetrying, retryError, retryPayment, refetchOrder } =
    useOrderPaymentResult()

  const successCta = isAuthenticated ? (
    <Button to={ORDERS_HREF}>{ORDER_RESULT_COPY.goToOrders}</Button>
  ) : (
    <Button to={APP_ROUTES.home}>{ORDER_RESULT_COPY.goHome}</Button>
  )

  const delayedCta = isAuthenticated ? (
    <Button to={ORDERS_HREF}>{ORDER_RESULT_COPY.goToOrders}</Button>
  ) : (
    <Button to={APP_ROUTES.home}>{ORDER_RESULT_COPY.goHome}</Button>
  )

  if (view === 'missing') {
    return (
      <section className={styles.CheckoutResultPage}>
        <EmptyState
          title={ORDER_RESULT_COPY.missingTitle}
          description={ORDER_RESULT_COPY.missingDescription}
          action={<Button to={APP_ROUTES.home}>{ORDER_RESULT_COPY.goHome}</Button>}
        />
      </section>
    )
  }

  if (view === 'loading') {
    return (
      <section className={styles.CheckoutResultPage}>
        <div
          className={styles['CheckoutResultPage-Pending']}
          role="status"
          aria-live="polite"
          aria-label={ORDER_RESULT_COPY.pendingStatusLabel}
        >
          <div className={styles['CheckoutResultPage-Spinner']} aria-hidden />
          <p className={styles['CheckoutResultPage-PendingText']}>
            {ORDER_RESULT_COPY.pendingDescription}
          </p>
        </div>
      </section>
    )
  }

  if (view === 'error') {
    return (
      <section className={styles.CheckoutResultPage}>
        <EmptyState
          title={ORDER_RESULT_COPY.loadErrorTitle}
          action={
            <Button type="button" onClick={refetchOrder}>
              {ORDER_RESULT_COPY.retryLoad}
            </Button>
          }
        />
      </section>
    )
  }

  if (view === 'success' && order) {
    return (
      <section className={styles.CheckoutResultPage}>
        <h1 className={styles['CheckoutResultPage-Title']}>
          {ORDER_RESULT_COPY.successTitle}
        </h1>
        <p className={styles['CheckoutResultPage-OrderId']}>
          {formatOrderNumberLabel(ORDER_RESULT_COPY.orderNumber, order.id)}
        </p>
        <div className={styles['CheckoutResultPage-Actions']}>{successCta}</div>
      </section>
    )
  }

  if (view === 'pending') {
    return (
      <section className={styles.CheckoutResultPage}>
        <h1 className={styles['CheckoutResultPage-Title']}>
          {ORDER_RESULT_COPY.pendingTitle}
        </h1>
        <div
          className={styles['CheckoutResultPage-Pending']}
          role="status"
          aria-live="polite"
          aria-label={ORDER_RESULT_COPY.pendingStatusLabel}
        >
          <div className={styles['CheckoutResultPage-Spinner']} aria-hidden />
          <p className={styles['CheckoutResultPage-PendingText']}>
            {ORDER_RESULT_COPY.pendingDescription}
          </p>
        </div>
      </section>
    )
  }

  if (view === 'delayed') {
    return (
      <section className={styles.CheckoutResultPage}>
        <EmptyState
          title={ORDER_RESULT_COPY.delayedTitle}
          description={ORDER_RESULT_COPY.delayedDescription}
          action={delayedCta}
        />
      </section>
    )
  }

  if (view === 'failed') {
    return (
      <section className={styles.CheckoutResultPage}>
        <EmptyState
          title={ORDER_RESULT_COPY.failedTitle}
          description={ORDER_RESULT_COPY.failedDescription}
          action={
            <div className={styles['CheckoutResultPage-Actions']}>
              <Button
                type="button"
                loading={isRetrying}
                onClick={() => {
                  void retryPayment()
                }}
              >
                {isRetrying
                  ? ORDER_RESULT_COPY.tryingAgain
                  : ORDER_RESULT_COPY.tryAgain}
              </Button>
              {retryError ? (
                <p className={styles['CheckoutResultPage-Error']}>{retryError}</p>
              ) : null}
            </div>
          }
        />
      </section>
    )
  }

  return null
}

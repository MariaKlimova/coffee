import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { useCart } from '@entities/cart'
import { useAuthStore } from '@entities/user'
import {
  paymentRecoveryPath,
  paymentRecoverySearch,
  resolvePaymentRecoveryOrderId,
  useCheckoutSubmit,
} from '@features/checkout'
import { APP_ROUTES } from '@shared/config/routes'
import { CART_PAGE_COPY, CHECKOUT_COPY, CANCELLATION_COPY } from '@shared/lib/copy'
import { Button, EmptyState, useToast } from '@shared/ui'

import { CheckoutPageForm } from './CheckoutPage-Form'
import { CheckoutPageSummary } from './CheckoutPage-Summary'
import { sumAvailableLineTotals } from './CheckoutPage.const'
import styles from './CheckoutPage.module.css'

/**
 * Страница оформления: сводка корзины, контакты гостя, оплата через ЮKassa.
 */
function CheckoutPageContent() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [recoveredOrderId] = useState(() => resolvePaymentRecoveryOrderId(searchParams))
  const [recoverFromUrl] = useState(() => searchParams.get('payment') === 'recovery')
  const [isNewCheckout, setIsNewCheckout] = useState(false)
  const { showToast } = useToast()
  const authStatus = useAuthStore((state) => state.status)
  const isGuest = authStatus === 'guest'
  const cartQuery = useCart()

  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const {
    fieldErrors,
    formError,
    isSubmitting,
    isRecovering,
    createdOrderId,
    unresolvedGuestCheckout,
    recoverCheckout,
    canRetryGuestCheckout,
    retryGuestCheckout,
    retryCartChanged,
    clearFieldError,
    handleSubmit,
  } = useCheckoutSubmit({
    isGuest,
    onOrderCreated: (orderId) => {
      setSearchParams(paymentRecoverySearch(orderId), { replace: true })
    },
  })

  const items = cartQuery.data?.items ?? []
  const availableTotal = sumAvailableLineTotals(items)
  const canPay = items.some((item) => item.product.in_stock)
  const showInitialSkeleton = cartQuery.isPending && !cartQuery.data
  const isEmpty = cartQuery.isSuccess && !showInitialSkeleton && items.length === 0
  const isRetryCartVerified =
    cartQuery.isSuccess &&
    !cartQuery.isFetching &&
    cartQuery.data.cart_token === unresolvedGuestCheckout?.originalCartToken

  useEffect(() => {
    if (
      !isEmpty ||
      isSubmitting ||
      createdOrderId ||
      recoveredOrderId ||
      unresolvedGuestCheckout
    ) {
      return
    }
    showToast({ message: CHECKOUT_COPY.emptyCartToast, variant: 'info' })
    void navigate(APP_ROUTES.cart, { replace: true })
  }, [
    isEmpty,
    isSubmitting,
    createdOrderId,
    recoveredOrderId,
    unresolvedGuestCheckout,
    navigate,
    showToast,
  ])

  if (authStatus === 'idle' || authStatus === 'restoring') {
    return null
  }

  if (unresolvedGuestCheckout && (!isSubmitting || isRecovering))
    return (
      <section className={styles.CheckoutPage}>
        <EmptyState
          title={CANCELLATION_COPY.checkoutRecoveryTitle}
          description={CANCELLATION_COPY.checkoutRecoveryHint}
          action={
            <Button
              loading={isSubmitting}
              onClick={() => {
                void recoverCheckout()
              }}
            >
              {CANCELLATION_COPY.check}
            </Button>
          }
        />
        {unresolvedGuestCheckout.createBody && (
          <div className={styles['CheckoutPage-SavedDetails']}>
            <h2>{CANCELLATION_COPY.savedCheckoutDetails}</h2>
            <dl>
              <dt>{CHECKOUT_COPY.addressLabel}</dt>
              <dd>{unresolvedGuestCheckout.createBody.delivery_address}</dd>
              <dt>{CHECKOUT_COPY.emailLabel}</dt>
              <dd>{unresolvedGuestCheckout.createBody.guest_email}</dd>
              <dt>{CHECKOUT_COPY.phoneLabel}</dt>
              <dd>{unresolvedGuestCheckout.createBody.guest_phone}</dd>
            </dl>
          </div>
        )}
        {isRetryCartVerified && (
          <CheckoutPageSummary items={items} total={availableTotal} />
        )}
        {formError && <p role="alert">{formError}</p>}
        {retryCartChanged && <p>{CANCELLATION_COPY.retryCartChanged}</p>}
        {canRetryGuestCheckout && (
          <div className={styles['CheckoutPage-RecoveryActions']}>
            <p>{CANCELLATION_COPY.retryCheckoutHint}</p>
            <Button
              variant="secondary"
              disabled={isSubmitting || !isRetryCartVerified}
              loading={isSubmitting}
              onClick={() => {
                void retryGuestCheckout()
              }}
            >
              {CANCELLATION_COPY.retryCheckout}
            </Button>
          </div>
        )}
        {canRetryGuestCheckout && !isRetryCartVerified && (
          <p>{CANCELLATION_COPY.retryCartUnverified}</p>
        )}
        {formError && (
          <Button href="#contacts" variant="ghost">
            {CANCELLATION_COPY.contactStore}
          </Button>
        )}
      </section>
    )

  const shouldResumeSavedOrder = !isNewCheckout && (recoverFromUrl || isEmpty)
  const recoveryOrderId =
    (!isSubmitting ? createdOrderId : null) ??
    (shouldResumeSavedOrder ? recoveredOrderId : null)
  if (recoveryOrderId) {
    return <Navigate to={paymentRecoveryPath(recoveryOrderId)} replace />
  }

  if (createdOrderId) {
    return (
      <section className={styles.CheckoutPage} role="status" aria-live="polite">
        <EmptyState
          title={CHECKOUT_COPY.orderCreated}
          description={CHECKOUT_COPY.startingPayment}
        />
      </section>
    )
  }

  if (cartQuery.isError) {
    return (
      <section className={styles.CheckoutPage}>
        <h1 className={styles['CheckoutPage-Title']}>{CHECKOUT_COPY.title}</h1>
        <EmptyState
          title={CART_PAGE_COPY.errorTitle}
          action={
            <Button
              type="button"
              onClick={() => {
                void cartQuery.refetch()
              }}
            >
              {CART_PAGE_COPY.retry}
            </Button>
          }
        />
      </section>
    )
  }

  if (isEmpty && !isSubmitting) {
    return <Navigate to={APP_ROUTES.cart} replace />
  }

  if (showInitialSkeleton) {
    return (
      <section className={styles.CheckoutPage}>
        <h1 className={styles['CheckoutPage-Title']}>{CHECKOUT_COPY.title}</h1>
      </section>
    )
  }

  if (recoveredOrderId && !isNewCheckout) {
    return (
      <section className={styles.CheckoutPage}>
        <EmptyState
          title={CHECKOUT_COPY.savedOrderTitle}
          description={CHECKOUT_COPY.savedOrderDescription}
          action={
            <div className={styles['CheckoutPage-RecoveryActions']}>
              <Button to={paymentRecoveryPath(recoveredOrderId)}>
                {CHECKOUT_COPY.resumePayment}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsNewCheckout(true)
                }}
              >
                {CHECKOUT_COPY.newOrder}
              </Button>
            </div>
          }
        />
      </section>
    )
  }

  return (
    <section className={styles.CheckoutPage}>
      <h1 className={styles['CheckoutPage-Title']}>{CHECKOUT_COPY.title}</h1>

      {!canPay ? (
        <EmptyState
          title={CHECKOUT_COPY.noAvailableItems}
          action={<Button to={APP_ROUTES.cart}>{CHECKOUT_COPY.goToCart}</Button>}
        />
      ) : (
        <div className={styles['CheckoutPage-Layout']}>
          <div className={styles['CheckoutPage-FormSlot']}>
            <CheckoutPageForm
              isGuest={isGuest}
              disabled={isSubmitting}
              isSubmitting={isSubmitting}
              formError={formError}
              fieldErrors={fieldErrors}
              values={{ deliveryAddress, email, phone }}
              canPay={canPay}
              onChange={(field, value) => {
                if (field === 'deliveryAddress') {
                  setDeliveryAddress(value)
                } else if (field === 'email') {
                  setEmail(value)
                } else {
                  setPhone(value)
                }
                clearFieldError(field)
              }}
              onSubmit={(event) => {
                void handleSubmit(event, {
                  deliveryAddress,
                  email,
                  phone,
                })
              }}
            />
          </div>
          <div className={styles['CheckoutPage-SummarySlot']}>
            <CheckoutPageSummary items={items} total={availableTotal} />
          </div>
        </div>
      )}
    </section>
  )
}

/** Смена покупателя сбрасывает локальные формы и незавершённые сетевые состояния. */
export function CheckoutPage() {
  const status = useAuthStore((state) => state.status)
  const generation = useAuthStore((state) => state.sessionGeneration)
  const userId = useAuthStore((state) => state.user?.id)
  return <CheckoutPageContent key={`${status}:${generation}:${userId ?? 'guest'}`} />
}

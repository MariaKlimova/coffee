import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { useCart } from '@entities/cart'
import { useAuthStore } from '@entities/user'
import { useCheckoutSubmit } from '@features/checkout'
import { APP_ROUTES } from '@shared/config/routes'
import { CART_PAGE_COPY, CHECKOUT_COPY } from '@shared/lib/copy'
import { Button, EmptyState, useToast } from '@shared/ui'

import { CheckoutPageForm } from './CheckoutPage-Form'
import { CheckoutPageSummary } from './CheckoutPage-Summary'
import { sumAvailableLineTotals } from './CheckoutPage.const'
import styles from './CheckoutPage.module.css'

/**
 * Страница оформления: сводка корзины, контакты гостя, оплата через ЮKassa.
 */
export function CheckoutPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const authStatus = useAuthStore((state) => state.status)
  const isGuest = authStatus === 'guest'
  const cartQuery = useCart()

  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const { fieldErrors, formError, isSubmitting, clearFieldError, handleSubmit } =
    useCheckoutSubmit({ isGuest })

  const items = cartQuery.data?.items ?? []
  const availableTotal = sumAvailableLineTotals(items)
  const canPay = items.some((item) => item.product.in_stock)
  const showInitialSkeleton = cartQuery.isPending && !cartQuery.data
  const isEmpty = cartQuery.isSuccess && !showInitialSkeleton && items.length === 0

  useEffect(() => {
    if (!isEmpty) {
      return
    }
    showToast({ message: CHECKOUT_COPY.emptyCartToast, variant: 'info' })
    void navigate(APP_ROUTES.cart, { replace: true })
  }, [isEmpty, navigate, showToast])

  if (authStatus === 'idle' || authStatus === 'restoring') {
    return null
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

  if (isEmpty) {
    return <Navigate to={APP_ROUTES.cart} replace />
  }

  if (showInitialSkeleton) {
    return (
      <section className={styles.CheckoutPage}>
        <h1 className={styles['CheckoutPage-Title']}>{CHECKOUT_COPY.title}</h1>
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

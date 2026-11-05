import { useEffect, useId, useRef, useState } from 'react'
import { isAxiosError, isCancel } from 'axios'

import { getOrderStatusLabel } from '@entities/order'
import { MANAGE_ORDERS_COPY as copy } from '@shared/lib/copy'
import { Button } from '@shared/ui/Button'
import { Textarea } from '@shared/ui/Textarea'

import type {
  AllowedOrderTransition,
  OrderTransitionWrite,
} from '../../api/manageOrdersApi.typings'
import { useOrderTransition } from '../../model/useOrderTransition'
import type { ManageOrderWorkflowProps } from './ManageOrderWorkflow.typings'
import styles from './ManageOrderWorkflow.module.css'

const actionLabels = {
  processing: copy.takeProcessing,
  shipped: copy.markShipped,
  delivered: copy.markDelivered,
  cancelled: copy.cancelOrder,
}

function actionLabel(action: AllowedOrderTransition) {
  if (action.to_status in actionLabels)
    return actionLabels[action.to_status as keyof typeof actionLabels]
  return null
}

function inventoryHint(action: AllowedOrderTransition) {
  if (action.inventory_reason === 'legacy_uncounted') return copy.legacyStock
  if (action.inventory_effect === 'release_reservation') return copy.releaseReservation
  if (action.inventory_effect === 'restore_stock') return copy.restoreStock
  return copy.unchangedStock
}

/** Подтверждение одной серверной команды с сохранением UUID неопределённого повтора. */
export function ManageOrderWorkflow({
  order,
  refreshing,
  verified,
  refresh,
}: ManageOrderWorkflowProps) {
  const titleId = useId()
  const confirmationId = useId()
  const hintId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const confirmationHeading = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)
  const busy = useRef(false)
  const [selection, setSelection] = useState<{
    action: AllowedOrderTransition
    expectedStatus: ManageOrderWorkflowProps['order']['status']
  } | null>(null)
  const [comment, setComment] = useState('')
  const [intent, setIntent] = useState<OrderTransitionWrite | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const mutation = useOrderTransition(order.id)
  const disabled = pending || refreshing || !verified
  const actions = (order.allowed_transitions ?? []).filter(actionLabel)
  const hasSucceededPayment =
    order.latest_payment_status === 'succeeded' ||
    order.payments.some((payment) => payment.status === 'succeeded')

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (selection) confirmationHeading.current?.focus()
  }, [selection])

  function close() {
    setSelection(null)
    setIntent(null)
    heading.current?.focus()
  }

  async function verifyCurrentOrder() {
    try {
      return await refresh()
    } catch {
      return false
    }
  }

  async function checkOrder() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    try {
      const checked = await verifyCurrentOrder()
      if (!checked) {
        if (mounted.current) {
          setError(copy.refreshError)
          setSuccess('')
        }
        return
      }
      if (mounted.current) {
        close()
        setError('')
        setSuccess(copy.checkedOrder)
      }
    } finally {
      busy.current = false
      if (mounted.current) setPending(false)
    }
  }

  async function submit() {
    if (!selection || busy.current || refreshing || !verified) return
    busy.current = true
    setPending(true)
    setError('')
    setSuccess('')
    const values = intent ?? {
      expected_status: selection.expectedStatus,
      to_status: selection.action.to_status,
      request_id: crypto.randomUUID(),
      comment: comment.trim(),
    }
    setIntent(values)
    try {
      const result = await mutation.submit(values)
      if (!mounted.current) return
      close()
      setComment('')
      setSuccess(result.replayed ? copy.transitionReplay : copy.transitionSuccess)
    } catch (failure: unknown) {
      if (!mounted.current || isCancel(failure)) return
      const response = isAxiosError(failure) ? failure.response : undefined
      const status = response?.status
      if (status === 409) {
        close()
        setError(
          response?.data?.code === 'idempotency_conflict'
            ? copy.idempotencyConflict
            : copy.transitionConflict,
        )
        await verifyCurrentOrder()
      } else if (status === 400) {
        setIntent(null)
        setError(copy.transitionInvalid)
      } else if (status === 401 || status === 403 || status === 404) {
        close()
        setError(status === 404 ? copy.transitionNotFound : copy.transitionDenied)
      } else {
        setError(copy.transitionError)
      }
    } finally {
      busy.current = false
      if (mounted.current) setPending(false)
    }
  }

  return (
    <section className={styles.ManageOrderWorkflow} aria-labelledby={titleId}>
      <h2 id={titleId} ref={heading} tabIndex={-1}>
        {copy.workflow}
      </h2>
      {error && (
        <p role="alert" className={styles['ManageOrderWorkflow-Error']}>
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
      {order.status === 'cancelled' && hasSucceededPayment && (
        <p className={styles['ManageOrderWorkflow-Warning']}>{copy.cancelledPaid}</p>
      )}
      {!selection && (
        <>
          {actions.length === 0 && (
            <p>
              {order.status === 'payment_review' ? copy.manualReview : copy.noActions}
            </p>
          )}
          <div className={styles['ManageOrderWorkflow-Actions']}>
            {actions.map((action) => (
              <Button
                key={action.to_status}
                variant={action.to_status === 'cancelled' ? 'secondary' : 'primary'}
                disabled={disabled}
                onClick={() => {
                  setSelection({ action, expectedStatus: order.status })
                  setError('')
                  setSuccess('')
                }}
              >
                {actionLabel(action)}
              </Button>
            ))}
          </div>
        </>
      )}
      {selection && (
        <form
          aria-labelledby={confirmationId}
          aria-describedby={hintId}
          className={styles['ManageOrderWorkflow-Confirmation']}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <h3 id={confirmationId} ref={confirmationHeading} tabIndex={-1}>
            {copy.confirmTitle}
          </h3>
          <p>
            {copy.confirmStatus(
              getOrderStatusLabel(selection.expectedStatus),
              getOrderStatusLabel(selection.action.to_status),
            )}
          </p>
          <p className={styles['ManageOrderWorkflow-Warning']}>
            {inventoryHint(selection.action)}
          </p>
          {selection.action.to_status === 'cancelled' &&
            (selection.expectedStatus === 'paid' ||
              selection.expectedStatus === 'processing') && (
              <p className={styles['ManageOrderWorkflow-Warning']}>
                {copy.separateRefund}
              </p>
            )}
          <Textarea
            label={copy.comment}
            value={comment}
            maxLength={500}
            disabled={pending || Boolean(intent)}
            onChange={(event) => setComment(event.target.value)}
          />
          <p id={hintId} className={styles['ManageOrderWorkflow-Hint']}>
            {copy.commentHint}
          </p>
          <div className={styles['ManageOrderWorkflow-Actions']}>
            <Button type="submit" disabled={disabled} loading={pending}>
              {intent ? copy.retryTransition : copy.confirm}
            </Button>
            {intent ? (
              <Button
                variant="ghost"
                disabled={pending || refreshing}
                onClick={() => {
                  void checkOrder()
                }}
              >
                {copy.checkOrder}
              </Button>
            ) : (
              <Button variant="ghost" disabled={disabled} onClick={close}>
                {copy.closeConfirmation}
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  )
}

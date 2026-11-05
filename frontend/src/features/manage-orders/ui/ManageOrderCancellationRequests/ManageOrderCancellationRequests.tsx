import { useEffect, useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError, isCancel } from 'axios'

import { bindStaff, useAuthStore } from '@entities/user'
import { CANCELLATION_COPY, MANAGE_ORDERS_COPY as copy } from '@shared/lib/copy'
import { Button } from '@shared/ui'
import { Textarea } from '@shared/ui/Textarea'

import { decideCancellationRequest } from '../../api/manageOrdersApi'
import type {
  CancellationDecisionWrite,
  ManageCancellationRequest,
  OrderStatusHistoryEntry,
} from '../../api/manageOrdersApi.typings'
import { formatManageOrderDate } from '../../lib/orderDisplay'
import { inventoryHint } from '../../lib/inventoryHint'
import type { ManageOrderCancellationRequestsProps } from './ManageOrderCancellationRequests.typings'
import styles from './ManageOrderCancellationRequests.module.css'

interface DecisionIntent {
  /** UUID обращения в пути. */
  requestId: string
  /** Неизменное подтверждённое решение. */
  values: CancellationDecisionWrite
}

function readIntent(key: string): DecisionIntent | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(key) ?? 'null',
    ) as DecisionIntent | null
    if (
      !value ||
      typeof value.requestId !== 'string' ||
      typeof value.values?.request_id !== 'string' ||
      !['accept', 'decline'].includes(value.values.decision) ||
      typeof value.values.public_response !== 'string' ||
      typeof value.values.private_comment !== 'string'
    )
      return null
    return value
  } catch {
    return null
  }
}

/** Рассмотрение обращения с раздельными публичным ответом и внутренним комментарием. */
export function ManageOrderCancellationRequests({
  order,
  refreshing,
  verified,
  refresh,
  onUnavailable,
}: ManageOrderCancellationRequestsProps) {
  const titleId = useId()
  const client = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)
  const generation = useAuthStore((state) => state.sessionGeneration)
  const assertActor = bindStaff()
  const storageKey = `coffee:staffCancellationIntent:${userId}:${order.id}`
  const prefix = ['manage-orders', generation, userId]
  const [intent, setIntent] = useState(() => readIntent(storageKey))
  const [selection, setSelection] = useState<{
    requestId: string
    decision: 'accept' | 'decline'
    status: OrderStatusHistoryEntry['from_status']
  } | null>(() => {
    const saved = readIntent(storageKey)
    return saved
      ? {
          requestId: saved.requestId,
          decision: saved.values.decision,
          status: saved.values.expected_status,
        }
      : null
  })
  const [publicResponse, setPublicResponse] = useState(
    () => readIntent(storageKey)?.values.public_response ?? '',
  )
  const [privateComment, setPrivateComment] = useState(
    () => readIntent(storageKey)?.values.private_comment ?? '',
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const mounted = useRef(false)
  const busy = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const requests = order.cancellation_requests ?? []
  const cancellation = order.allowed_transitions.find(
    (action) => action.to_status === 'cancelled',
  )
  const disabled = pending || refreshing || !verified

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (selection) heading.current?.focus()
  }, [selection])

  function isCurrent() {
    try {
      assertActor()
      return true
    } catch {
      return false
    }
  }

  function clear() {
    sessionStorage.removeItem(storageKey)
    setIntent(null)
    setSelection(null)
  }

  async function currentOrder() {
    const current = await refresh()
    assertActor()
    if (!current) throw new Error(copy.refreshError)
    return current
  }

  async function select(
    request: ManageCancellationRequest,
    decision: 'accept' | 'decline',
  ) {
    if (busy.current || disabled) return
    busy.current = true
    setPending(true)
    setError('')
    setMessage('')
    try {
      const current = await currentOrder()
      if (!mounted.current) return
      if (
        !current.cancellation_requests?.some(
          (item) => item.id === request.id && item.state === 'open',
        ) ||
        !['paid', 'processing'].includes(current.status) ||
        !current.allowed_transitions.some((item) => item.to_status === 'cancelled')
      ) {
        setError(copy.transitionConflict)
        return
      }
      setSelection({ requestId: request.id, decision, status: current.status })
    } catch (failure) {
      try {
        assertActor()
      } catch {
        return
      }
      if (mounted.current && !isCancel(failure)) setError(copy.refreshError)
    } finally {
      busy.current = false
      if (mounted.current && isCurrent()) setPending(false)
    }
  }

  async function check() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    try {
      await currentOrder()
      if (!mounted.current) return
      clear()
      setError('')
      setMessage(copy.checkedOrder)
    } catch (failure) {
      try {
        assertActor()
      } catch {
        return
      }
      if (mounted.current && !isCancel(failure)) setError(copy.refreshError)
    } finally {
      busy.current = false
      if (mounted.current && isCurrent()) setPending(false)
    }
  }

  async function submit() {
    if (!selection || busy.current || disabled) return
    if (!publicResponse.trim()) {
      setError(copy.publicResponseRequired)
      return
    }
    busy.current = true
    setPending(true)
    setError('')
    const command: DecisionIntent = intent ?? {
      requestId: selection.requestId,
      values: {
        request_id: crypto.randomUUID(),
        decision: selection.decision,
        expected_status: selection.status,
        public_response: publicResponse.trim(),
        private_comment: privateComment.trim(),
      },
    }
    try {
      assertActor()
      sessionStorage.setItem(storageKey, JSON.stringify(command))
      setIntent(command)
      const result = await decideCancellationRequest(
        order.id,
        command.requestId,
        command.values,
        assertActor,
      )
      await client.cancelQueries({ queryKey: prefix })
      assertActor()
      if (!mounted.current) return
      const key = [...prefix, 'detail', order.id]
      if (client.getQueryCache().find({ queryKey: key, exact: true })?.isActive())
        client.setQueryData(key, result.order)
      clear()
      setPublicResponse('')
      setPrivateComment('')
      setMessage(copy.decisionSuccess)
      await Promise.all([
        client.invalidateQueries({ queryKey: prefix }),
        client.invalidateQueries({ queryKey: ['products'] }),
        client.invalidateQueries({ queryKey: ['manage-catalog', generation, userId] }),
      ])
    } catch (failure) {
      try {
        assertActor()
      } catch {
        return
      }
      if (!mounted.current || isCancel(failure)) return
      const status = isAxiosError(failure) ? failure.response?.status : undefined
      if (status === 409) {
        clear()
        setError(copy.transitionConflict)
        try {
          await currentOrder()
        } catch {
          /* Следующая проверка повторяется явно. */
        }
      } else if (status === 400) {
        sessionStorage.removeItem(storageKey)
        setIntent(null)
        setError(copy.transitionInvalid)
      } else if (status === 401 || status === 403 || status === 404) {
        clear()
        onUnavailable(status)
      } else setError(copy.transitionError)
    } finally {
      busy.current = false
      if (mounted.current && isCurrent()) setPending(false)
    }
  }

  if (!requests.length) return null
  return (
    <section
      className={styles.ManageOrderCancellationRequests}
      aria-labelledby={titleId}
    >
      <h2 id={titleId}>{copy.cancellationRequests}</h2>
      {error && (
        <p role="alert" className={styles['ManageOrderCancellationRequests-Error']}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {requests.map((request) => (
        <div
          key={request.id}
          className={styles['ManageOrderCancellationRequests-Request']}
        >
          <h3>{CANCELLATION_COPY[request.state]}</h3>
          <time dateTime={request.created_at}>
            {formatManageOrderDate(request.created_at)}
          </time>
          <p>{request.reason}</p>
          {request.public_response && (
            <p>
              {copy.publicResponse}: {request.public_response}
            </p>
          )}
          {request.private_comment && (
            <p>
              {copy.privateComment}: {request.private_comment}
            </p>
          )}
          {request.decided_by && <p>{request.decided_by.label}</p>}
          {request.decided_at && (
            <time dateTime={request.decided_at}>
              {formatManageOrderDate(request.decided_at)}
            </time>
          )}
          {request.state === 'open' && !selection && (
            <div className={styles['ManageOrderCancellationRequests-Actions']}>
              <Button
                disabled={disabled}
                onClick={() => {
                  void select(request, 'accept')
                }}
              >
                {copy.acceptCancellation}
              </Button>
              <Button
                disabled={disabled}
                variant="secondary"
                onClick={() => {
                  void select(request, 'decline')
                }}
              >
                {copy.declineCancellation}
              </Button>
            </div>
          )}
        </div>
      ))}
      {selection && (
        <form
          className={styles['ManageOrderCancellationRequests-Form']}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <h3 ref={heading} tabIndex={-1}>
            {copy.confirmCancellationDecision}
          </h3>
          <strong>
            {selection.decision === 'accept'
              ? copy.acceptCancellation
              : copy.declineCancellation}
          </strong>
          {selection.decision === 'accept' ? (
            <>
              <p>{cancellation ? inventoryHint(cancellation) : copy.unchangedStock}</p>
              <p>{copy.separateRefund}</p>
            </>
          ) : (
            <p>{copy.declineHint}</p>
          )}
          <Textarea
            label={copy.publicResponse}
            value={publicResponse}
            required
            maxLength={500}
            disabled={pending || Boolean(intent)}
            onChange={(event) => setPublicResponse(event.target.value)}
          />
          <p className={styles['ManageOrderCancellationRequests-Hint']}>
            {copy.publicResponseHint}
          </p>
          <Textarea
            label={copy.privateComment}
            value={privateComment}
            maxLength={500}
            disabled={pending || Boolean(intent)}
            onChange={(event) => setPrivateComment(event.target.value)}
          />
          <p className={styles['ManageOrderCancellationRequests-Hint']}>
            {copy.privateCommentHint}
          </p>
          <div className={styles['ManageOrderCancellationRequests-Actions']}>
            <Button type="submit" disabled={disabled} loading={pending}>
              {intent ? copy.retryTransition : copy.confirm}
            </Button>
            {intent ? (
              <Button
                variant="ghost"
                disabled={pending || refreshing}
                onClick={() => {
                  void check()
                }}
              >
                {copy.checkOrder}
              </Button>
            ) : (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setSelection(null)}
              >
                {copy.closeConfirmation}
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  )
}

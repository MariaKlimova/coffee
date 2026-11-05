import { useEffect, useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError, isCancel } from 'axios'

import {
  formatOrderDate,
  readGuestOrderProof,
  recoverGuestCheckout,
  submitBuyerAction,
  writeGuestOrderProof,
  type BuyerAction,
  type OrderStatus,
} from '@entities/order'
import { CANCELLATION_COPY as copy } from '@shared/lib/copy'
import { cx } from '@shared/lib/cx'
import { Button } from '@shared/ui'
import { Textarea } from '@shared/ui/Textarea'

import {
  clearBuyerIntent,
  readBuyerIntent,
  saveBuyerIntent,
  type BuyerIntent,
} from '../../model/buyerIntent'
import { useBuyerOrder } from '../../model/useBuyerOrder'
import type {
  BuyerOrderActionsProps,
  BuyerOrderCancellationProps,
} from './BuyerOrderCancellation.typings'
import styles from './BuyerOrderCancellation.module.css'

/** Самостоятельный блок для строки списка; карточка передаёт уже загруженный запрос. */
export function BuyerOrderCancellation({ id, inline }: BuyerOrderCancellationProps) {
  const buyer = useBuyerOrder(id)
  return <BuyerOrderActions key={buyer.scope} id={id} buyer={buyer} inline={inline} />
}

/** Подтверждает только свежее серверное действие, сохраняя неопределённый повтор. */
export function BuyerOrderActions({ id, buyer, inline }: BuyerOrderActionsProps) {
  const client = useQueryClient()
  const titleId = useId()
  const confirmation = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)
  const busy = useRef(false)
  const [intent, setIntent] = useState<BuyerIntent | null>(() =>
    readBuyerIntent(buyer.actorKey, id),
  )
  const [selection, setSelection] = useState<{
    action: BuyerAction
    status: OrderStatus
  } | null>(() => {
    const saved = readBuyerIntent(buyer.actorKey, id)
    return saved ? { action: saved.action, status: saved.values.expected_status } : null
  })
  const [reason, setReason] = useState(
    () => readBuyerIntent(buyer.actorKey, id)?.values.reason ?? '',
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const data = buyer.data
  const unavailable =
    !buyer.ready ||
    (isAxiosError(buyer.error) &&
      [401, 403, 404].includes(buyer.error.response?.status ?? 0))
  const disabled = pending || buyer.isFetching || buyer.isError || !data
  const expanded = Boolean(
    selection ||
    error ||
    message ||
    unavailable ||
    buyer.isError ||
    (data && !data.allowed_actions.length) ||
    data?.cancellation_requests.length,
  )
  const className = cx(
    styles.BuyerOrderCancellation,
    inline && styles['BuyerOrderCancellation--inline'],
    inline && expanded && styles['BuyerOrderCancellation--expanded'],
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (selection) confirmation.current?.focus()
  }, [selection])

  function isCurrent() {
    try {
      buyer.assertActor()
      return true
    } catch {
      return false
    }
  }

  async function refreshed() {
    const current = await buyer.refetch()
    buyer.assertActor()
    if (!current.isSuccess || !current.data) throw new Error(copy.refreshError)
    return current.data
  }

  function clearIntent() {
    clearBuyerIntent(buyer.actorKey, id)
    setIntent(null)
    setSelection(null)
  }

  async function select(action: BuyerAction) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    setMessage('')
    try {
      const current = await refreshed()
      if (!mounted.current) return
      if (!current.allowed_actions.includes(action)) {
        setError(copy.conflict)
        return
      }
      setSelection({ action, status: current.order.status })
    } catch (failure) {
      if (mounted.current && isCurrent() && !isCancel(failure))
        setError(copy.refreshError)
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
      await refreshed()
      if (!mounted.current) return
      clearIntent()
      setError('')
      setMessage(copy.checked)
    } catch (failure) {
      if (mounted.current && isCurrent() && !isCancel(failure))
        setError(copy.refreshError)
    } finally {
      busy.current = false
      if (mounted.current && isCurrent()) setPending(false)
    }
  }

  async function submit() {
    if (!selection || busy.current || disabled) return
    if (selection.action === 'request_cancellation' && !reason.trim()) {
      setError(copy.reasonError)
      return
    }
    busy.current = true
    setPending(true)
    setError('')
    const command = intent ?? {
      action: selection.action,
      values: {
        request_id: crypto.randomUUID(),
        expected_status: selection.status,
        reason: reason.trim(),
      },
    }
    try {
      buyer.assertActor()
      saveBuyerIntent(buyer.actorKey, id, command)
      setIntent(command)
      const result = await submitBuyerAction(
        id,
        command.action,
        command.values,
        buyer.assertActor,
        buyer.token,
      )
      await client.cancelQueries({ queryKey: buyer.queryKey })
      buyer.assertActor()
      if (!mounted.current) return
      client.setQueryData(buyer.queryKey, result.buyer_actions)
      clearIntent()
      setReason('')
      setMessage(command.action === 'cancel' ? copy.successCancel : copy.successRequest)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['orders'] }),
        client.invalidateQueries({ queryKey: ['products'] }),
        client.invalidateQueries({ queryKey: ['cart'] }),
      ])
    } catch (failure) {
      try {
        buyer.assertActor()
      } catch {
        return
      }
      if (!mounted.current || isCancel(failure)) return
      const status = isAxiosError(failure) ? failure.response?.status : undefined
      if (status === 409) {
        clearIntent()
        setError(copy.conflict)
        try {
          await refreshed()
        } catch {
          /* Снимок остаётся недоступным до успешной проверки. */
        }
      } else if (status === 400) {
        clearBuyerIntent(buyer.actorKey, id)
        setIntent(null)
        setError(copy.reasonError)
      } else if (status === 401 || status === 403 || status === 404) {
        clearIntent()
        await buyer.refetch()
      } else {
        setError(copy.uncertain)
      }
    } finally {
      busy.current = false
      if (mounted.current && isCurrent()) setPending(false)
    }
  }

  async function recover() {
    const proof = readGuestOrderProof(id)
    if (!proof || buyer.actorKey !== 'guest' || busy.current) return
    busy.current = true
    setPending(true)
    try {
      const result = await recoverGuestCheckout(
        proof.checkoutRequestId,
        proof.originalCartToken,
        buyer.assertActor,
      )
      writeGuestOrderProof({
        ...proof,
        token: result.guest_action_token,
        version: result.guest_action_version,
      })
    } catch (failure) {
      if (mounted.current && isCurrent() && !isCancel(failure))
        setError(copy.recoveryError)
    } finally {
      busy.current = false
      if (mounted.current && isCurrent()) setPending(false)
    }
  }

  if (unavailable)
    return (
      <section className={className} aria-labelledby={titleId}>
        <h2 id={titleId}>{copy.unavailable}</h2>
        <p>{copy.contact}</p>
        <div className={styles['BuyerOrderCancellation-Actions']}>
          <Button href="#contacts" variant="secondary">
            {copy.contactStore}
          </Button>
          {buyer.actorKey === 'guest' && readGuestOrderProof(id) && (
            <Button
              disabled={pending}
              onClick={() => {
                void recover()
              }}
            >
              {copy.recover}
            </Button>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
      </section>
    )

  return (
    <section className={className} aria-label={copy.title}>
      {error && (
        <p role="alert" className={styles['BuyerOrderCancellation-Error']}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {buyer.isPending && <p role="status">{copy.loading}</p>}
      {data &&
        !selection &&
        !data.allowed_actions.length &&
        !data.cancellation_requests.length && <p>{copy.noActions}</p>}
      {buyer.isError && (
        <Button
          disabled={pending}
          onClick={() => {
            void check()
          }}
        >
          {copy.check}
        </Button>
      )}
      {!selection && (
        <div className={styles['BuyerOrderCancellation-Actions']}>
          {data?.allowed_actions.map((action) => (
            <Button
              key={action}
              variant="secondary"
              disabled={disabled}
              onClick={() => {
                void select(action)
              }}
            >
              {action === 'cancel' ? copy.cancel : copy.request}
            </Button>
          ))}
        </div>
      )}
      {selection && (
        <form
          className={styles['BuyerOrderCancellation-Form']}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <h3 ref={confirmation} tabIndex={-1}>
            {selection.action === 'cancel' ? copy.confirmCancel : copy.confirmRequest}
          </h3>
          <p>{selection.action === 'cancel' ? copy.cancelHint : copy.requestHint}</p>
          <p className={styles['BuyerOrderCancellation-Hint']}>{copy.refundHint}</p>
          <Textarea
            label={copy.reason}
            value={reason}
            maxLength={500}
            required={selection.action === 'request_cancellation'}
            disabled={pending || Boolean(intent)}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className={styles['BuyerOrderCancellation-Hint']}>
            {selection.action === 'cancel' ? copy.optionalReason : copy.requiredReason}
          </p>
          <div className={styles['BuyerOrderCancellation-Actions']}>
            <Button type="submit" disabled={disabled} loading={pending}>
              {intent ? copy.retry : copy.confirm}
            </Button>
            {intent ? (
              <Button
                variant="ghost"
                disabled={pending || buyer.isFetching}
                onClick={() => {
                  void check()
                }}
              >
                {copy.check}
              </Button>
            ) : (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setSelection(null)}
              >
                {copy.back}
              </Button>
            )}
          </div>
        </form>
      )}
      {Boolean(data?.cancellation_requests.length) && (
        <div className={styles['BuyerOrderCancellation-History']}>
          <h3>{copy.history}</h3>
          {data?.cancellation_requests.map((request) => (
            <div key={request.id} className={styles['BuyerOrderCancellation-Request']}>
              <strong>{copy[request.state]}</strong>
              <time dateTime={request.created_at}>
                {formatOrderDate(request.created_at)}
              </time>
              <p>{request.reason}</p>
              {request.public_response && <p>{request.public_response}</p>}
              {request.decided_at && (
                <time dateTime={request.decided_at}>
                  {formatOrderDate(request.decided_at)}
                </time>
              )}
            </div>
          ))}
          <p className={styles['BuyerOrderCancellation-Hint']}>{copy.refundHint}</p>
        </div>
      )}
    </section>
  )
}

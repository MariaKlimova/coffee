import { useState } from 'react'
import axios from 'axios'

import { MANAGE_COPY } from '@shared/lib/copy'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'

import type { ManageStockEditorProps } from './ManageStockEditor.typings'
import styles from './ManageStockEditor.module.css'

export function ManageStockEditor({
  product,
  onSave,
  onClose,
}: ManageStockEditorProps) {
  const [quantity, setQuantity] = useState(String(product.stock_quantity))
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  return (
    <form
      className={styles.ManageStockEditor}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        if (pending) return
        if (!/^\d+$/.test(quantity) || Number(quantity) > 2147483647) {
          setError(MANAGE_COPY.quantityInvalid)
          return
        }
        if (product.origin === 'demo' && !consent) {
          setError(MANAGE_COPY.demoConsentRequired)
          return
        }
        setError('')
        setPending(true)
        try {
          await onSave({
            id: product.id,
            stock_quantity: Number(quantity),
            ...(consent ? { save_as_owner: true } : {}),
          })
          onClose()
        } catch (reason) {
          const errors: unknown = axios.isAxiosError(reason)
            ? reason.response?.data?.errors
            : undefined
          if (errors && typeof errors === 'object' && 'stock_quantity' in errors) {
            setError(MANAGE_COPY.quantityConflict)
          } else {
            setError(MANAGE_COPY.saveError)
          }
        } finally {
          setPending(false)
        }
      }}
    >
      <Input
        label={MANAGE_COPY.physicalQuantity}
        type="text"
        inputMode="numeric"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        helperText={MANAGE_COPY.quantityHint}
        disabled={pending}
        errorText={error || undefined}
        autoFocus
      />
      {product.origin === 'demo' && (
        <label className={styles['ManageStockEditor-Consent']}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            disabled={pending}
          />
          {MANAGE_COPY.demoConsent}
        </label>
      )}
      {product.origin === 'demo' && <p>{MANAGE_COPY.convertExplanation}</p>}
      <div className={styles['ManageStockEditor-Actions']}>
        <Button type="submit" size="sm" loading={pending}>
          {MANAGE_COPY.save}
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={onClose}>
          {MANAGE_COPY.cancel}
        </Button>
      </div>
    </form>
  )
}

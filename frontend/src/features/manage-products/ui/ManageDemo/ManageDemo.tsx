import { useState } from 'react'

import { MANAGE_COPY } from '@shared/lib/copy'
import { Button } from '@shared/ui/Button'

import type { ManageDemoProps } from './ManageDemo.typings'
import styles from './ManageDemo.module.css'

export function ManageDemo({ catalog, onDisable }: ManageDemoProps) {
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  return (
    <section className={styles.ManageDemo} aria-labelledby="manage-demo-title">
      <h2 id="manage-demo-title">
        {catalog.demo_enabled ? MANAGE_COPY.demoTitle : MANAGE_COPY.demoDisabled}
      </h2>
      <p>
        {catalog.demo_enabled
          ? MANAGE_COPY.demoDescription
          : MANAGE_COPY.demoDisabledDescription}
      </p>
      <p>
        {MANAGE_COPY.demoCounts(
          catalog.demo_product_count,
          catalog.owner_product_count,
        )}
      </p>
      {catalog.demo_enabled && !confirm && (
        <Button variant="secondary" onClick={() => setConfirm(true)}>
          {MANAGE_COPY.disableDemo}
        </Button>
      )}
      {catalog.demo_enabled && confirm && (
        <section
          className={styles['ManageDemo-Confirmation']}
          aria-labelledby="manage-demo-confirm-title"
        >
          <h3 id="manage-demo-confirm-title">{MANAGE_COPY.confirmTitle}</h3>
          <p>
            {MANAGE_COPY.confirmDescription(
              catalog.demo_product_count,
              catalog.owner_product_count,
            )}
          </p>
          {catalog.published_owner_product_count === 0 && (
            <p className={styles['ManageDemo-Warning']}>{MANAGE_COPY.emptyFuture}</p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className={styles['ManageDemo-Actions']}>
            <Button
              loading={pending}
              onClick={async () => {
                if (pending) return
                setPending(true)
                setError('')
                try {
                  await onDisable()
                  setConfirm(false)
                } catch {
                  setError(MANAGE_COPY.cutoverError)
                } finally {
                  setPending(false)
                }
              }}
            >
              {MANAGE_COPY.confirmDisable}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setConfirm(false)
                setError('')
              }}
            >
              {MANAGE_COPY.cancel}
            </Button>
          </div>
        </section>
      )}
    </section>
  )
}

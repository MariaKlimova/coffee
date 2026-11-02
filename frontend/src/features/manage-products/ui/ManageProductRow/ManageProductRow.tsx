import { useState } from 'react'
import { Link } from 'react-router-dom'

import { CATEGORY_LABELS, resolveProductImages } from '@entities/product'
import { APP_ROUTES } from '@shared/config'
import { MANAGE_COPY } from '@shared/lib/copy'
import { Button } from '@shared/ui/Button'
import { Badge } from '@shared/ui/Badge'

import { ManageStockEditor } from '../ManageStockEditor'
import type { ManageProductRowProps } from './ManageProductRow.typings'
import styles from './ManageProductRow.module.css'

export function ManageProductRow({ product, onSave, onHide }: ManageProductRowProps) {
  const [editing, setEditing] = useState(false)
  const [confirmOwner, setConfirmOwner] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const image = resolveProductImages(product)[0]
  async function save(values: Parameters<typeof onSave>[0]) {
    setMessage('')
    const result = await onSave(values)
    setMessage(MANAGE_COPY.saved)
    return result
  }
  async function changePublication() {
    if (pending) return
    setPending(true)
    setMessage('')
    try {
      if (product.origin === 'demo') {
        await onHide(product.id)
        setMessage(MANAGE_COPY.saved)
      } else {
        await save({ id: product.id, is_published: !product.is_published })
      }
    } catch {
      setMessage(MANAGE_COPY.saveError)
    } finally {
      setPending(false)
    }
  }
  return (
    <li className={styles.ManageProductRow}>
      <div className={styles['ManageProductRow-Summary']}>
        <Link
          to={`${APP_ROUTES.manageProducts}/${product.id}/edit`}
          className={styles['ManageProductRow-Link']}
        >
          {image ? (
            <img
              className={styles['ManageProductRow-Image']}
              src={image}
              alt=""
              loading="lazy"
            />
          ) : (
            <span className={styles['ManageProductRow-Image']}>
              {MANAGE_COPY.noPhoto}
            </span>
          )}
          <span>
            <strong>{product.name}</strong>
            <span className={styles['ManageProductRow-Category']}>
              {CATEGORY_LABELS[product.category]}
            </span>
          </span>
        </Link>
        <span>
          {new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            maximumFractionDigits: 2,
          }).format(Number(product.price))}
        </span>
        <div className={styles['ManageProductRow-Badges']}>
          <Badge>
            {product.origin === 'demo' ? MANAGE_COPY.demo : MANAGE_COPY.owner}
          </Badge>
          <Badge variant={product.is_published ? 'success' : 'neutral'}>
            {product.is_published ? MANAGE_COPY.published : MANAGE_COPY.unpublished}
          </Badge>
          {product.hidden_reason === 'demo_disabled' && (
            <Badge>{MANAGE_COPY.demoHidden}</Badge>
          )}
        </div>
      </div>
      <div className={styles['ManageProductRow-Quantity']}>
        <strong>{MANAGE_COPY.available(product.available_quantity)}</strong>
        <span>
          {MANAGE_COPY.quantities(product.stock_quantity, product.reserved_quantity)}
        </span>
      </div>
      <div className={styles['ManageProductRow-Actions']}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setMessage('')
            setEditing(!editing)
            setConfirmOwner(false)
          }}
          disabled={pending || editing || confirmOwner}
        >
          {MANAGE_COPY.changeQuantity}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          to={`${APP_ROUTES.manageProducts}/${product.id}/edit`}
        >
          {MANAGE_COPY.editProduct}
        </Button>
        {(product.origin === 'owner' || product.is_published) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void changePublication()
            }}
            loading={pending}
          >
            {product.is_published ? MANAGE_COPY.hide : MANAGE_COPY.publish}
          </Button>
        )}
        {product.origin === 'demo' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessage('')
              setConfirmOwner(true)
            }}
            disabled={pending || editing}
          >
            {MANAGE_COPY.saveAsOwner}
          </Button>
        )}
      </div>
      {editing && (
        <ManageStockEditor
          product={product}
          onSave={save}
          onClose={() => setEditing(false)}
        />
      )}
      {confirmOwner && (
        <section
          className={styles['ManageProductRow-Confirm']}
          aria-label={MANAGE_COPY.saveAsOwner}
        >
          <p>{MANAGE_COPY.convertExplanation}</p>
          <div className={styles['ManageProductRow-Actions']}>
            <Button
              size="sm"
              loading={pending}
              onClick={async () => {
                if (pending) return
                setPending(true)
                try {
                  await save({ id: product.id, save_as_owner: true })
                  setConfirmOwner(false)
                } catch {
                  setMessage(MANAGE_COPY.saveError)
                } finally {
                  setPending(false)
                }
              }}
            >
              {MANAGE_COPY.saveAsOwner}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirmOwner(false)}
            >
              {MANAGE_COPY.cancel}
            </Button>
          </div>
        </section>
      )}
      {message && <p role="status">{message}</p>}
    </li>
  )
}

import { Link } from 'react-router-dom'

import { CART_COPY, CART_PAGE_COPY } from '@shared/lib/copy'
import { cx } from '@shared/lib/cx'
import { formatMoney } from '@shared/lib/formatMoney'
import { Badge, Button } from '@shared/ui'

import type { CartPageItemProps } from './CartPage-Item.typings'
import styles from './CartPage-Item.module.css'

/**
 * Строка позиции корзины: товар, количество, сумма, удаление.
 */
export function CartPageItem({ item, onQuantityChange, onRemove }: CartPageItemProps) {
  const { product, quantity, line_total: lineTotal, id } = item
  const inStock = product.in_stock
  const quantityId = `${id}-quantity`
  const productHref = `/product/${product.slug}`

  return (
    <article
      className={cx(
        styles['CartPage-Item'],
        !inStock && styles['CartPage-Item--outOfStock'],
      )}
      data-testid="cart-page-item"
    >
      <div className={styles['CartPage-Item-Media']}>
        {product.image_url ? (
          <img
            className={styles['CartPage-Item-Image']}
            src={product.image_url}
            alt=""
          />
        ) : null}
      </div>

      <div className={styles['CartPage-Item-Body']}>
        <div className={styles['CartPage-Item-TitleRow']}>
          <Link className={styles['CartPage-Item-Title']} to={productHref}>
            {product.name}
          </Link>
          {!inStock ? <Badge>{CART_COPY.outOfStock}</Badge> : null}
        </div>

        <p className={styles['CartPage-Item-UnitPrice']}>
          {formatMoney(product.price)}
        </p>

        <div className={styles['CartPage-Item-Controls']}>
          <div
            className={styles['CartPage-Item-Qty']}
            role="group"
            aria-label={CART_COPY.quantityLabel}
          >
            <button
              type="button"
              className={styles['CartPage-Item-QtyButton']}
              aria-label={CART_COPY.decreaseQty}
              disabled={!inStock || quantity <= 1}
              onClick={() => {
                onQuantityChange(id, Math.max(1, quantity - 1))
              }}
            >
              −
            </button>
            <span
              id={quantityId}
              className={styles['CartPage-Item-QtyValue']}
              aria-live="polite"
            >
              {quantity}
            </span>
            <button
              type="button"
              className={styles['CartPage-Item-QtyButton']}
              aria-label={CART_COPY.increaseQty}
              disabled={!inStock}
              onClick={() => {
                onQuantityChange(id, quantity + 1)
              }}
            >
              +
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onRemove(id)
            }}
          >
            {CART_PAGE_COPY.remove}
          </Button>
        </div>
      </div>

      <div className={styles['CartPage-Item-Aside']}>
        <p className={styles['CartPage-Item-LineTotal']}>{formatMoney(lineTotal)}</p>
      </div>
    </article>
  )
}

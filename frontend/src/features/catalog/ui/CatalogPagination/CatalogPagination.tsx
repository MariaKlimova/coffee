import { cx } from '@shared/lib/cx'

import { CATALOG_COPY } from '../../catalog.const'
import { buildPageItems } from '../../lib/buildPageItems'
import type { CatalogPaginationProps } from './CatalogPagination.typings'
import styles from './CatalogPagination.module.css'

export function CatalogPagination({
  page,
  count,
  pageSize,
  onPageChange,
  className,
}: CatalogPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  if (count === 0 || totalPages <= 1) {
    return null
  }

  const items = buildPageItems(page, totalPages)

  return (
    <nav
      className={cx(styles.CatalogPagination, className)}
      aria-label={CATALOG_COPY.paginationLabel}
    >
      <button
        type="button"
        className={styles['CatalogPagination-Button']}
        disabled={page <= 1}
        onClick={() => {
          onPageChange(page - 1)
        }}
      >
        {CATALOG_COPY.previousPage}
      </button>

      {items.map((item) => {
        if (item.type === 'ellipsis') {
          return (
            <span
              key={item.key}
              className={styles['CatalogPagination-Ellipsis']}
              aria-hidden
            >
              …
            </span>
          )
        }

        const isCurrent = item.page === page
        return (
          <button
            key={item.page}
            type="button"
            className={cx(
              styles['CatalogPagination-Button'],
              isCurrent && styles['CatalogPagination-Button--current'],
            )}
            aria-current={isCurrent ? 'page' : undefined}
            onClick={() => {
              onPageChange(item.page)
            }}
          >
            {item.page}
          </button>
        )
      })}

      <button
        type="button"
        className={styles['CatalogPagination-Button']}
        disabled={page >= totalPages}
        onClick={() => {
          onPageChange(page + 1)
        }}
      >
        {CATALOG_COPY.nextPage}
      </button>
    </nav>
  )
}

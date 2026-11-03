import { useEffect, useId, useRef, useState } from 'react'

import { cx } from '@shared/lib/cx'
import { Button, Select } from '@shared/ui'

import { CATALOG_COPY, SORT_OPTIONS } from '../../../catalog.const'
import { parsePriceInput } from '../../../lib/parsePriceInput'
import { CatalogFiltersDialog } from '../CatalogFilters-Dialog'
import type { CatalogFilterValues } from '../CatalogFilters-Fields'
import type { CatalogFiltersProps } from '../CatalogFilters.typings'
import styles from './CatalogFilters-Mobile.module.css'

export function CatalogFiltersMobile({
  priceMin,
  priceMax,
  inStockOnly,
  ordering,
  onChange,
  navigationKey,
  className,
}: CatalogFiltersProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const id = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CatalogFilterValues>({
    priceMin: priceMin ?? '',
    priceMax: priceMax ?? '',
    inStockOnly,
  })
  const activeCount =
    Number(Boolean(priceMin)) + Number(Boolean(priceMax)) + Number(inStockOnly)
  const applied = [
    priceMin && `${CATALOG_COPY.priceFromLabel} ${priceMin}`,
    priceMax && `${CATALOG_COPY.priceToLabel} ${priceMax}`,
    inStockOnly && CATALOG_COPY.inStockOnlyLabel,
  ]
    .filter(Boolean)
    .join(' · ')

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog?.open) dialog.close()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [navigationKey])

  useEffect(() => {
    if (!open) return
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = previous
    }
  }, [open])

  return (
    <div className={cx(styles['CatalogFilters-Mobile'], className)}>
      <div className={styles['CatalogFilters-Mobile-Toolbar']}>
        <Button
          variant="secondary"
          aria-haspopup="dialog"
          aria-controls={id}
          aria-expanded={open}
          onClick={() => {
            setDraft({
              priceMin: priceMin ?? '',
              priceMax: priceMax ?? '',
              inStockOnly,
            })
            dialogRef.current?.showModal()
            setOpen(true)
          }}
        >
          {activeCount
            ? CATALOG_COPY.filtersWithCount(activeCount)
            : CATALOG_COPY.filtersLabel}
        </Button>
        <Select
          className={styles['CatalogFilters-Mobile-Sort']}
          aria-label={CATALOG_COPY.sortingLabel}
          options={SORT_OPTIONS}
          value={ordering}
          onChange={(event) =>
            onChange({
              ordering: event.target.value as CatalogFiltersProps['ordering'],
            })
          }
        />
      </div>
      {applied ? (
        <p
          className={styles['CatalogFilters-Mobile-Applied']}
          aria-label={CATALOG_COPY.appliedFiltersLabel}
        >
          {applied}
        </p>
      ) : null}
      <CatalogFiltersDialog
        dialogRef={dialogRef}
        id={id}
        values={draft}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onReset={() => setDraft({ priceMin: '', priceMax: '', inStockOnly: false })}
        onClose={() => setOpen(false)}
        onApply={() => {
          dialogRef.current?.close()
          onChange({
            priceMin: parsePriceInput(draft.priceMin),
            priceMax: parsePriceInput(draft.priceMax),
            inStockOnly: draft.inStockOnly,
          })
        }}
      />
    </div>
  )
}

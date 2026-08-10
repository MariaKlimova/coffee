import { useState, type FormEvent, type KeyboardEvent } from 'react'

import { cx } from '@shared/lib/cx'
import { Checkbox, Input, Select } from '@shared/ui'

import { CATALOG_COPY, SORT_OPTIONS } from '../../catalog.const'
import { parsePriceInput } from '../../lib/parsePriceInput'
import type { CatalogFiltersProps } from './CatalogFilters.typings'
import styles from './CatalogFilters.module.css'

function CatalogFiltersFields({
  priceMin,
  priceMax,
  inStockOnly,
  ordering,
  onChange,
  className,
}: CatalogFiltersProps) {
  const [priceFrom, setPriceFrom] = useState(priceMin ?? '')
  const [priceTo, setPriceTo] = useState(priceMax ?? '')

  function commitPriceFrom(): void {
    const next = parsePriceInput(priceFrom)
    if (next === priceMin) {
      setPriceFrom(priceMin ?? '')
      return
    }
    onChange({ priceMin: next })
  }

  function commitPriceTo(): void {
    const next = parsePriceInput(priceTo)
    if (next === priceMax) {
      setPriceTo(priceMax ?? '')
      return
    }
    onChange({ priceMax: next })
  }

  function onPriceKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    commit: () => void,
  ): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    commitPriceFrom()
    commitPriceTo()
  }

  return (
    <form
      className={cx(styles.CatalogFilters, className)}
      aria-label={CATALOG_COPY.filtersLabel}
      onSubmit={onSubmit}
    >
      <p className={styles['CatalogFilters-Title']}>{CATALOG_COPY.filtersLabel}</p>

      <div className={styles['CatalogFilters-PriceRow']}>
        <Input
          label={CATALOG_COPY.priceFromLabel}
          inputMode="decimal"
          value={priceFrom}
          onChange={(event) => {
            setPriceFrom(event.target.value)
          }}
          onBlur={commitPriceFrom}
          onKeyDown={(event) => {
            onPriceKeyDown(event, commitPriceFrom)
          }}
        />
        <Input
          label={CATALOG_COPY.priceToLabel}
          inputMode="decimal"
          value={priceTo}
          onChange={(event) => {
            setPriceTo(event.target.value)
          }}
          onBlur={commitPriceTo}
          onKeyDown={(event) => {
            onPriceKeyDown(event, commitPriceTo)
          }}
        />
      </div>

      <Checkbox
        label={CATALOG_COPY.inStockOnlyLabel}
        checked={inStockOnly}
        onChange={(event) => {
          onChange({ inStockOnly: event.target.checked })
        }}
      />

      <Select
        label={CATALOG_COPY.sortingLabel}
        options={SORT_OPTIONS}
        value={ordering}
        onChange={(event) => {
          onChange({
            ordering: event.target.value as CatalogFiltersProps['ordering'],
          })
        }}
      />
    </form>
  )
}

export function CatalogFilters(props: CatalogFiltersProps) {
  // Remount draft price fields when URL-backed values change (reset / back).
  const priceKey = `${props.priceMin ?? ''}|${props.priceMax ?? ''}`
  return <CatalogFiltersFields key={priceKey} {...props} />
}

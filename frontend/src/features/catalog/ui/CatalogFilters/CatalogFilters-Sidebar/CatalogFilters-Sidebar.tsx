import { useState, type FormEvent } from 'react'

import { cx } from '@shared/lib/cx'
import { Select } from '@shared/ui'

import { CATALOG_COPY, SORT_OPTIONS } from '../../../catalog.const'
import { parsePriceInput } from '../../../lib/parsePriceInput'
import {
  CatalogFiltersFields,
  type CatalogFilterValues,
} from '../CatalogFilters-Fields'
import type { CatalogFiltersProps } from '../CatalogFilters.typings'
import styles from './CatalogFilters-Sidebar.module.css'

export function CatalogFiltersSidebar(props: CatalogFiltersProps) {
  const { priceMin, priceMax, inStockOnly, ordering, onChange, className } = props
  const [prices, setPrices] = useState({
    priceMin: priceMin ?? '',
    priceMax: priceMax ?? '',
  })

  function commitPrice(field: 'priceMin' | 'priceMax'): void {
    const next = parsePriceInput(prices[field])
    if (next === props[field]) {
      setPrices((current) => ({ ...current, [field]: props[field] ?? '' }))
      return
    }
    onChange({ [field]: next })
  }

  function changeFields(patch: Partial<CatalogFilterValues>): void {
    if (patch.inStockOnly !== undefined) onChange({ inStockOnly: patch.inStockOnly })
    setPrices((current) => ({
      priceMin: patch.priceMin ?? current.priceMin,
      priceMax: patch.priceMax ?? current.priceMax,
    }))
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onChange({
      priceMin: parsePriceInput(prices.priceMin),
      priceMax: parsePriceInput(prices.priceMax),
    })
  }

  return (
    <form
      className={cx(styles['CatalogFilters-Sidebar'], className)}
      aria-label={CATALOG_COPY.filtersLabel}
      onSubmit={onSubmit}
    >
      <p className={styles['CatalogFilters-Sidebar-Title']}>
        {CATALOG_COPY.filtersLabel}
      </p>
      <CatalogFiltersFields
        values={{ ...prices, inStockOnly }}
        onChange={changeFields}
        onPriceCommit={commitPrice}
      />
      <Select
        label={CATALOG_COPY.sortingLabel}
        options={SORT_OPTIONS}
        value={ordering}
        onChange={(event) => {
          onChange({ ordering: event.target.value as CatalogFiltersProps['ordering'] })
        }}
      />
    </form>
  )
}

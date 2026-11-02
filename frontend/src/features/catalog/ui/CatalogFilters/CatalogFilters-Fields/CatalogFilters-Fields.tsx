import { CATALOG_COPY } from '@shared/lib/copy'
import { Checkbox, Input } from '@shared/ui'

import type { CatalogFiltersFieldsProps } from './CatalogFilters-Fields.typings'
import styles from './CatalogFilters-Fields.module.css'

export function CatalogFiltersFields({
  values,
  onChange,
  onPriceCommit,
}: CatalogFiltersFieldsProps) {
  return (
    <>
      <div className={styles['CatalogFilters-Fields-PriceRow']}>
        {(['priceMin', 'priceMax'] as const).map((field) => (
          <Input
            key={field}
            label={
              field === 'priceMin'
                ? CATALOG_COPY.priceFromLabel
                : CATALOG_COPY.priceToLabel
            }
            inputMode="decimal"
            value={values[field]}
            onChange={(event) => onChange({ [field]: event.target.value })}
            onBlur={() => onPriceCommit?.(field)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && onPriceCommit) {
                event.preventDefault()
                onPriceCommit(field)
              }
            }}
          />
        ))}
      </div>
      <Checkbox
        label={CATALOG_COPY.inStockOnlyLabel}
        checked={values.inStockOnly}
        onChange={(event) => onChange({ inStockOnly: event.target.checked })}
      />
    </>
  )
}

import { CATALOG_COPY } from '@shared/lib/copy'
import { Button } from '@shared/ui'

import { CatalogFiltersFields } from '../CatalogFilters-Fields'
import type { CatalogFiltersDialogProps } from './CatalogFilters-Dialog.typings'
import styles from './CatalogFilters-Dialog.module.css'

export function CatalogFiltersDialog({
  dialogRef,
  id,
  values,
  onChange,
  onApply,
  onReset,
  onClose,
}: CatalogFiltersDialogProps) {
  return (
    <dialog
      ref={dialogRef}
      id={id}
      aria-labelledby={`${id}-title`}
      className={styles['CatalogFilters-Dialog']}
      onClose={onClose}
    >
      <form
        className={styles['CatalogFilters-Dialog-Form']}
        onSubmit={(event) => {
          event.preventDefault()
          onApply()
        }}
      >
        <div className={styles['CatalogFilters-Dialog-Heading']}>
          <h2 id={`${id}-title`} className={styles['CatalogFilters-Dialog-Title']}>
            {CATALOG_COPY.filtersLabel}
          </h2>
          <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
            {CATALOG_COPY.close}
          </Button>
        </div>
        <CatalogFiltersFields values={values} onChange={onChange} />
        <div className={styles['CatalogFilters-Dialog-Actions']}>
          <Button type="submit">{CATALOG_COPY.applyFilters}</Button>
          <Button variant="secondary" onClick={onReset}>
            {CATALOG_COPY.resetFilters}
          </Button>
        </div>
      </form>
    </dialog>
  )
}

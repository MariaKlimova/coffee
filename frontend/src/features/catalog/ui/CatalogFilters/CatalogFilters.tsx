import { CatalogFiltersMobile } from './CatalogFilters-Mobile'
import { CatalogFiltersSidebar } from './CatalogFilters-Sidebar'
import type { CatalogFiltersProps } from './CatalogFilters.typings'
import { useCompactFilters } from './useCompactFilters'

export function CatalogFilters(props: CatalogFiltersProps) {
  const compact = useCompactFilters()
  if (compact) return <CatalogFiltersMobile {...props} />

  // Синхронизируем черновики цены с URL при сбросе и переходе по истории.
  const priceKey = `${props.priceMin ?? ''}|${props.priceMax ?? ''}`
  return <CatalogFiltersSidebar key={priceKey} {...props} />
}

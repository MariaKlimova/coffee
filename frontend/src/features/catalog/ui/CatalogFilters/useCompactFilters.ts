import { useSyncExternalStore } from 'react'

const COMPACT_FILTERS_QUERY = '(max-width: 63.999rem)'

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.(COMPACT_FILTERS_QUERY)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

/** Согласует мобильную панель с шириной адаптивной шапки. */
export function useCompactFilters(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(COMPACT_FILTERS_QUERY).matches ?? false,
    () => false,
  )
}

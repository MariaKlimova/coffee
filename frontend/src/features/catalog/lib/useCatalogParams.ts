import { useSearchParams } from 'react-router-dom'

import { DEFAULT_ORDERING } from '../catalog.const'
import { buildCatalogSearchParams, parseCatalogParams } from './catalogSearchParams'
import type { CatalogFilterPatch, CatalogParams } from './catalogSearchParams.typings'

function commitParams(
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  next: CatalogParams,
  options: { replace: boolean },
): void {
  setSearchParams(buildCatalogSearchParams(next), { replace: options.replace })
}

/**
 * Синхронизирует поиск, фильтры и страницу каталога с URL.
 */
export function useCatalogParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseCatalogParams(searchParams)

  function setSearch(search: string): void {
    // URL хранит текст набора; parser нормализует только применённый API-фильтр.
    const next = new URLSearchParams(searchParams)
    if (search) next.set('search', search)
    else next.delete('search')
    next.delete('page')
    next.delete('product')
    setSearchParams(next, { replace: true })
  }

  function setFilters(patch: CatalogFilterPatch): void {
    commitParams(
      setSearchParams,
      {
        ...params,
        ...patch,
        page: 1,
      },
      { replace: true },
    )
  }

  function setPage(page: number): void {
    commitParams(
      setSearchParams,
      {
        ...params,
        page,
      },
      { replace: true },
    )
  }

  function resetFilters(): void {
    commitParams(
      setSearchParams,
      {
        search: params.search,
        inStockOnly: false,
        ordering: DEFAULT_ORDERING,
        page: 1,
      },
      { replace: true },
    )
  }

  return {
    params,
    setSearch,
    setFilters,
    setPage,
    resetFilters,
  }
}

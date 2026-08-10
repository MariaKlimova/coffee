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
 * Syncs catalog filters, page, and expanded product with the URL query string.
 */
export function useCatalogParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseCatalogParams(searchParams)

  function setFilters(patch: CatalogFilterPatch): void {
    commitParams(
      setSearchParams,
      {
        ...params,
        ...patch,
        page: 1,
        product: null,
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
        product: null,
      },
      { replace: true },
    )
  }

  function expandProduct(slug: string): void {
    if (params.product === slug) {
      collapseProduct()
      return
    }
    commitParams(
      setSearchParams,
      {
        ...params,
        product: slug,
      },
      { replace: false },
    )
  }

  function collapseProduct(): void {
    commitParams(
      setSearchParams,
      {
        ...params,
        product: null,
      },
      { replace: false },
    )
  }

  /** Drops `?product=` without a history entry (orphan deep-links, cleanup). */
  function clearProduct(): void {
    if (!params.product) {
      return
    }
    commitParams(
      setSearchParams,
      {
        ...params,
        product: null,
      },
      { replace: true },
    )
  }

  function resetFilters(): void {
    commitParams(
      setSearchParams,
      {
        inStockOnly: false,
        ordering: DEFAULT_ORDERING,
        page: 1,
        product: null,
      },
      { replace: true },
    )
  }

  return {
    params,
    setFilters,
    setPage,
    expandProduct,
    collapseProduct,
    clearProduct,
    resetFilters,
  }
}

import { useSearchParams } from 'react-router-dom'

import { DEFAULT_ORDERING } from '../catalog.const'
import { buildCatalogSearchParams, parseCatalogParams } from './catalogSearchParams'
import type { CatalogFilterPatch, CatalogParams } from './catalogSearchParams.typings'
import type { OpenProductAtOptions } from './useCatalogParams.typings'

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

  /**
   * Opens a product on a known page in one URL write.
   * Used when switching from the similar-products strip.
   */
  function openProductAt({ slug, page, resetFilters }: OpenProductAtOptions): void {
    const next: CatalogParams = resetFilters
      ? {
          inStockOnly: false,
          ordering: params.ordering,
          page,
          product: slug,
        }
      : {
          ...params,
          page,
          product: slug,
        }

    commitParams(setSearchParams, next, { replace: false })
  }

  function resetFilters(): void {
    commitParams(
      setSearchParams,
      {
        search: params.search,
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
    setSearch,
    setFilters,
    setPage,
    expandProduct,
    collapseProduct,
    clearProduct,
    openProductAt,
    resetFilters,
  }
}

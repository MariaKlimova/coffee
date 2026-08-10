import type { ProductOrdering } from '@entities/product'

import { DEFAULT_ORDERING } from '../catalog.const'
import type { CatalogParams } from './catalogSearchParams.typings'
import { parsePriceInput } from './parsePriceInput'

const ORDERING_VALUES = new Set<ProductOrdering>([
  'price',
  '-price',
  'created_at',
  '-created_at',
])

function parseOrdering(raw: string | null): ProductOrdering {
  if (!raw || !ORDERING_VALUES.has(raw as ProductOrdering)) {
    return DEFAULT_ORDERING
  }
  return raw as ProductOrdering
}

function parsePage(raw: string | null): number {
  if (!raw) {
    return 1
  }
  const page = Number.parseInt(raw, 10)
  if (!Number.isFinite(page) || page < 1) {
    return 1
  }
  return page
}

/**
 * Reads catalog state from URL search params, ignoring invalid values.
 */
export function parseCatalogParams(searchParams: URLSearchParams): CatalogParams {
  const inStockRaw = searchParams.get('in_stock')
  const productRaw = searchParams.get('product')

  return {
    priceMin: parsePriceInput(searchParams.get('price_min')),
    priceMax: parsePriceInput(searchParams.get('price_max')),
    inStockOnly: inStockRaw === 'true' || inStockRaw === '1',
    ordering: parseOrdering(searchParams.get('ordering')),
    page: parsePage(searchParams.get('page')),
    product: productRaw && productRaw.trim() ? productRaw.trim() : null,
  }
}

/**
 * Serializes catalog state into URL search params (defaults omitted).
 */
export function buildCatalogSearchParams(params: CatalogParams): URLSearchParams {
  const next = new URLSearchParams()

  if (params.priceMin) {
    next.set('price_min', params.priceMin)
  }
  if (params.priceMax) {
    next.set('price_max', params.priceMax)
  }
  if (params.inStockOnly) {
    next.set('in_stock', 'true')
  }
  if (params.ordering !== DEFAULT_ORDERING) {
    next.set('ordering', params.ordering)
  }
  if (params.page > 1) {
    next.set('page', String(params.page))
  }
  if (params.product) {
    next.set('product', params.product)
  }

  return next
}

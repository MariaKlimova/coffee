import { describe, expect, it } from 'vitest'

import { buildCatalogSearchParams, parseCatalogParams } from './catalogSearchParams'

describe('catalogSearchParams', () => {
  it('normalizes search and preserves it when serializing catalog state', () => {
    const params = parseCatalogParams(new URLSearchParams('search=++Эфиопия++'))
    expect(params.search).toBe('Эфиопия')
    expect(buildCatalogSearchParams(params).get('search')).toBe('Эфиопия')
    expect(parseCatalogParams(new URLSearchParams('search=+++')).search).toBeUndefined()
    expect(buildCatalogSearchParams({ ...params, search: '  ' }).has('search')).toBe(
      false,
    )
  })
  it('parses valid filter and expand params', () => {
    const params = parseCatalogParams(
      new URLSearchParams(
        'price_min=100&price_max=5000&in_stock=true&ordering=price&page=2&product=ethiopia',
      ),
    )

    expect(params).toEqual({
      search: undefined,
      priceMin: '100',
      priceMax: '5000',
      inStockOnly: true,
      ordering: 'price',
      page: 2,
      product: 'ethiopia',
    })
  })

  it('ignores invalid values and applies defaults', () => {
    const params = parseCatalogParams(
      new URLSearchParams('price_min=-1&ordering=weird&page=0&in_stock=maybe'),
    )

    expect(params).toEqual({
      search: undefined,
      priceMin: undefined,
      priceMax: undefined,
      inStockOnly: false,
      ordering: '-created_at',
      page: 1,
      product: null,
    })
  })

  it('omits defaults when building search params', () => {
    const search = buildCatalogSearchParams({
      inStockOnly: false,
      ordering: '-created_at',
      page: 1,
      product: null,
    })

    expect(search.toString()).toBe('')
  })

  it('writes non-default values into the query string', () => {
    const search = buildCatalogSearchParams({
      priceMin: '100.00',
      priceMax: '2000',
      inStockOnly: true,
      ordering: '-price',
      page: 3,
      product: 'essenza-mini',
    })

    expect(search.get('price_min')).toBe('100.00')
    expect(search.get('price_max')).toBe('2000')
    expect(search.get('in_stock')).toBe('true')
    expect(search.get('ordering')).toBe('-price')
    expect(search.get('page')).toBe('3')
    expect(search.get('product')).toBe('essenza-mini')
  })
})

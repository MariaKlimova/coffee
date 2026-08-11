import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Paginated, ProductListItem } from '../api/productApi.typings'
import { MAX_SCANNED_PAGES } from '../product.const'
import { findProductPage } from './findProductPage'

const { fetchProducts } = vi.hoisted(() => ({ fetchProducts: vi.fn() }))

vi.mock('../api/productApi', () => ({ fetchProducts }))

function item(slug: string): ProductListItem {
  return {
    id: `id-${slug}`,
    name: slug,
    slug,
    short_description: '',
    price: '1000.00',
    old_price: null,
    category: 'coffee',
    in_stock: true,
    image_url: null,
    is_favorite: false,
  }
}

function page(slugs: string[], hasNext: boolean): Paginated<ProductListItem> {
  return {
    count: 100,
    next: hasNext ? 'http://example/api/products/?page=next' : null,
    previous: null,
    results: slugs.map(item),
  }
}

function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('findProductPage', () => {
  beforeEach(() => {
    fetchProducts.mockReset()
  })

  it('returns 1 when the slug is on the first page', async () => {
    fetchProducts.mockResolvedValue(page(['a', 'target'], false))

    const result = await findProductPage({
      queryClient: createQueryClient(),
      slug: 'target',
      category: 'coffee',
      ordering: '-created_at',
    })

    expect(result).toBe(1)
    expect(fetchProducts).toHaveBeenCalledTimes(1)
  })

  it('keeps scanning while `next` is set and returns the matching page', async () => {
    fetchProducts
      .mockResolvedValueOnce(page(['a'], true))
      .mockResolvedValueOnce(page(['b'], true))
      .mockResolvedValueOnce(page(['c', 'target'], true))

    const result = await findProductPage({
      queryClient: createQueryClient(),
      slug: 'target',
      category: 'machines',
      ordering: '-created_at',
    })

    expect(result).toBe(3)
    expect(fetchProducts).toHaveBeenCalledTimes(3)
    expect(fetchProducts).toHaveBeenLastCalledWith({
      category: 'machines',
      page: 3,
      page_size: 20,
      ordering: '-created_at',
    })
  })

  it('stops scanning at MAX_SCANNED_PAGES even when `next` never ends', async () => {
    fetchProducts.mockResolvedValue(page(['a'], true))

    const result = await findProductPage({
      queryClient: createQueryClient(),
      slug: 'target',
      category: 'coffee',
      ordering: '-created_at',
    })

    expect(result).toBeNull()
    expect(fetchProducts).toHaveBeenCalledTimes(MAX_SCANNED_PAGES)
  })

  it('returns null when the listing ends without the slug', async () => {
    fetchProducts
      .mockResolvedValueOnce(page(['a'], true))
      .mockResolvedValueOnce(page(['b'], false))

    const result = await findProductPage({
      queryClient: createQueryClient(),
      slug: 'target',
      category: 'coffee',
      ordering: '-created_at',
    })

    expect(result).toBeNull()
    expect(fetchProducts).toHaveBeenCalledTimes(2)
  })
})

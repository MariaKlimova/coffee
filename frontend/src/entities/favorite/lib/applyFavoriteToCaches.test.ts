import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { favoriteKeys } from '../model/favoriteQueryOptions'
import { applyFavoriteToCaches } from './applyFavoriteToCaches'

const productId = '11111111-1111-1111-1111-111111111111'

const listItem = {
  id: productId,
  name: 'Эфиопия Иргачеффе',
  slug: 'ethiopia-yirgacheffe',
  short_description: 'Цветочный аромат',
  price: '1290.00',
  old_price: null,
  category: 'coffee' as const,
  in_stock: true,
  image_url: null,
  is_favorite: true,
}

describe('applyFavoriteToCaches', () => {
  it('removes a product from favorite list caches and updates the count without product caches', () => {
    const queryClient = new QueryClient()
    const listKey = favoriteKeys.list({ page: 1, page_size: 20 })

    queryClient.setQueryData(listKey, {
      count: 2,
      next: null,
      previous: null,
      results: [
        listItem,
        {
          ...listItem,
          id: '22222222-2222-2222-2222-222222222222',
          slug: 'brazil-santos',
          name: 'Бразилия Сантос',
        },
      ],
    })
    queryClient.setQueryData(favoriteKeys.count(), 2)

    applyFavoriteToCaches(queryClient, productId, false)

    const page = queryClient.getQueryData(listKey) as {
      count: number
      results: Array<{ id: string }>
    }
    expect(page.results).toHaveLength(1)
    expect(page.results[0]?.id).toBe('22222222-2222-2222-2222-222222222222')
    expect(page.count).toBe(1)
    expect(queryClient.getQueryData(favoriteKeys.count())).toBe(1)
  })

  it('does not invent an insert when re-favoriting on a list page', () => {
    const queryClient = new QueryClient()
    const listKey = favoriteKeys.list({ page: 1, page_size: 20 })

    queryClient.setQueryData(listKey, {
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
    queryClient.setQueryData(favoriteKeys.count(), 0)

    applyFavoriteToCaches(queryClient, productId, true)

    const page = queryClient.getQueryData(listKey) as {
      count: number
      results: unknown[]
    }
    expect(page.results).toHaveLength(0)
    expect(page.count).toBe(0)
    expect(queryClient.getQueryData(favoriteKeys.count())).toBe(0)
  })
})

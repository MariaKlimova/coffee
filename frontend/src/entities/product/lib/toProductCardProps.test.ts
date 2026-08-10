import { describe, expect, it } from 'vitest'

import type { ProductListItem } from '../api/productApi.typings'
import { toProductCardProps } from './toProductCardProps'

const baseItem: ProductListItem = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Эфиопия Иргачеффе',
  slug: 'ethiopia-yirgacheffe',
  short_description: 'Цветочный аромат',
  price: '1290.00',
  old_price: '1490.00',
  category: 'coffee',
  in_stock: true,
  image_url: 'https://example.com/coffee.jpg',
  is_favorite: false,
}

describe('toProductCardProps', () => {
  it('maps list fields onto ProductCard props', () => {
    expect(toProductCardProps(baseItem)).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      categoryLabel: 'Кофе',
      title: 'Эфиопия Иргачеффе',
      description: 'Цветочный аромат',
      images: ['https://example.com/coffee.jpg'],
      price: '1\u00A0290\u00A0₽',
      oldPrice: '1\u00A0490\u00A0₽',
      inStock: true,
      isFavorite: false,
    })
  })

  it('uses an empty images array when image_url is null', () => {
    expect(
      toProductCardProps({ ...baseItem, image_url: null, old_price: null }).images,
    ).toEqual([])
  })
})

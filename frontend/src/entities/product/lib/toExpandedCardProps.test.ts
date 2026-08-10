import { describe, expect, it } from 'vitest'

import type { Product } from '../api/productApi.typings'
import { toExpandedCardProps } from './toExpandedCardProps'

const coffeeProduct: Product = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Эфиопия Иргачеффе',
  slug: 'ethiopia-yirgacheffe',
  short_description: 'Короткое описание',
  description: 'Полное описание',
  price: '1290.00',
  old_price: null,
  category: 'coffee',
  in_stock: true,
  image_url: 'https://example.com/cover.jpg',
  is_favorite: false,
  attributes: {
    country: 'Эфиопия',
    intensity: 8,
    bitterness: 2,
    acidity: 4,
    roast: 2,
    density: 3,
  },
  images: [
    { url: 'https://example.com/1.jpg', order: 0, is_main: true },
    { url: 'https://example.com/2.jpg', order: 1, is_main: false },
  ],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

describe('toExpandedCardProps', () => {
  it('maps coffee detail onto ExpandedProductCard props', () => {
    expect(toExpandedCardProps(coffeeProduct)).toEqual({
      id: 'ethiopia-yirgacheffe',
      category: 'coffee',
      categoryLabel: 'Кофе',
      title: 'Эфиопия Иргачеффе',
      description: 'Полное описание',
      images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      price: '1\u00A0290\u00A0₽',
      oldPrice: undefined,
      attributes: {
        originCountry: 'Эфиопия',
        intensity: 8,
        bitterness: 2,
        acidity: 4,
        roast: 2,
        density: 3,
      },
    })
  })

  it('falls back to short_description and fills missing attributes', () => {
    const sparse: Product = {
      ...coffeeProduct,
      description: '',
      attributes: {},
      images: [],
      image_url: null,
    }

    const mapped = toExpandedCardProps(sparse)
    expect(mapped.description).toBe('Короткое описание')
    expect(mapped.images).toEqual([])
    if (mapped.category !== 'coffee') {
      throw new Error('expected coffee')
    }
    expect(mapped.attributes).toEqual({
      originCountry: '—',
      intensity: 0,
      bitterness: 0,
      acidity: 0,
      roast: 0,
      density: 0,
    })
  })

  it('maps machine attributes with units', () => {
    const machine: Product = {
      ...coffeeProduct,
      category: 'machines',
      name: 'Essenza Mini',
      slug: 'essenza-mini',
      attributes: {
        dimensions: '11 × 32.5 × 20.5 см',
        pressure_bar: 19,
        power_w: 1310,
        capsule_format: 'Nespresso',
        manufacturer_country: 'Швейцария',
      },
    }

    const mapped = toExpandedCardProps(machine)
    expect(mapped.category).toBe('machines')
    if (mapped.category !== 'machines') {
      throw new Error('expected machines')
    }
    expect(mapped.attributes).toEqual({
      dimensions: '11 × 32.5 × 20.5 см',
      pressureBar: '19 бар',
      powerW: '1310 Вт',
      capsuleFormat: 'Nespresso',
      manufacturerCountry: 'Швейцария',
    })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEMO_CATALOG_IMAGES } from './demoCatalogImages.const'
import { resolveProductImages } from './resolveProductImages'

const importedCoffeeId = '082b798d-6647-4c02-af0e-328aa48074e9'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveProductImages', () => {
  it.each([undefined, 'false', '1', 'True'])(
    'не включает демо при флаге %s',
    (flag) => {
      vi.stubEnv('VITE_ENABLE_DEMO_CATALOG_IMAGES', flag)
      expect(resolveProductImages({ id: importedCoffeeId, image_url: null })).toEqual(
        [],
      )
    },
  )

  it('выбирает фото для всех 18 импортированных UUID только при явном флаге', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_CATALOG_IMAGES', 'true')
    expect(DEMO_CATALOG_IMAGES.size).toBe(18)
    const urls: string[] = []
    for (const [id, image] of DEMO_CATALOG_IMAGES) {
      const resolved = resolveProductImages({ id, image_url: null })
      expect(resolved).toEqual([image])
      urls.push(...resolved)
    }
    expect(urls.filter((url) => url === '/demo/catalog/coffee.webp')).toHaveLength(9)
    expect(urls.filter((url) => url === '/demo/catalog/machine.webp')).toHaveLength(9)
  })

  it('не назначает фото неизвестному или QA-товару', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_CATALOG_IMAGES', 'true')
    for (const id of ['new-owner-product', 'f8c72313-9f2f-4d4b-a3fa-35f1079aa3d6']) {
      expect(resolveProductImages({ id, image_url: null })).toEqual([])
    }
  })

  it('сохраняет реальную обложку импортированного товара вместо демо', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_CATALOG_IMAGES', 'true')
    expect(
      resolveProductImages({
        id: importedCoffeeId,
        image_url: 'https://owner.example.test/cover.webp',
        images: [],
      }),
    ).toEqual(['https://owner.example.test/cover.webp'])
  })

  it('сохраняет порядок реальной галереи с приоритетом над обложкой и демо', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_CATALOG_IMAGES', 'true')
    const product = {
      id: importedCoffeeId,
      image_url: 'https://owner.example.test/cover.webp',
      images: [
        { url: 'https://owner.example.test/first.webp', order: 0, is_main: true },
        { url: 'https://owner.example.test/second.webp', order: 1, is_main: false },
      ],
    }
    const before = structuredClone(product)
    expect(resolveProductImages(product)).toEqual(
      product.images.map((image) => image.url),
    )
    expect(product).toEqual(before)
  })

  it('показывает реальные фото и при выключенном демо-режиме', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_CATALOG_IMAGES', 'false')
    expect(
      resolveProductImages({
        id: 'owner-product',
        image_url: 'https://owner.example.test/photo.webp',
      }),
    ).toEqual(['https://owner.example.test/photo.webp'])
  })
})

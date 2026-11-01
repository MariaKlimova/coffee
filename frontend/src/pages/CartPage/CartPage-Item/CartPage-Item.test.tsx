import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CartItem } from '@entities/cart'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'

import { CartPageItem } from './CartPage-Item'

const demoItem: CartItem = {
  id: 'cart-item',
  quantity: 1,
  line_total: '890.00',
  product: {
    id: '082b798d-6647-4c02-af0e-328aa48074e9',
    name: 'Демонстрационный кофе',
    slug: 'demo-coffee',
    short_description: '',
    price: '890.00',
    old_price: null,
    category: 'coffee',
    in_stock: true,
    image_url: null,
    is_favorite: false,
  },
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('CartPageItem: изображения', () => {
  it('использует общий демо-resolver для импортированной позиции', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_CATALOG_IMAGES', 'true')
    const { container } = renderWithProviders(
      <CartPageItem item={demoItem} onQuantityChange={vi.fn()} onRemove={vi.fn()} />,
    )
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/demo/catalog/coffee.webp',
    )
  })

  it('отдаёт приоритет настоящему фото той же позиции', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_CATALOG_IMAGES', 'true')
    const item = {
      ...demoItem,
      product: {
        ...demoItem.product,
        image_url: 'https://owner.example.test/real.webp',
      },
    }
    const { container } = renderWithProviders(
      <CartPageItem item={item} onQuantityChange={vi.fn()} onRemove={vi.fn()} />,
    )
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://owner.example.test/real.webp',
    )
  })

  it('не подставляет фото по совпадающим названию и slug другого товара', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_CATALOG_IMAGES', 'true')
    const item = { ...demoItem, product: { ...demoItem.product, id: 'owner-product' } }
    const { container } = renderWithProviders(
      <CartPageItem item={item} onQuantityChange={vi.fn()} onRemove={vi.fn()} />,
    )
    expect(container.querySelector('img')).toBeNull()
  })
})

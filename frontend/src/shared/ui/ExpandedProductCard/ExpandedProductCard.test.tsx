import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CART_COPY } from '@shared/lib/copy'

import { ExpandedProductCard } from './ExpandedProductCard'

describe('ExpandedProductCard cart CTA', () => {
  it('calls onAddToCart with the selected quantity', async () => {
    const user = userEvent.setup()
    const onAddToCart = vi.fn()

    render(
      <ExpandedProductCard
        id="p1"
        category="coffee"
        categoryLabel="Кофе"
        title="Эфиопия"
        description="Описание"
        images={[]}
        price="1 290 ₽"
        attributes={{
          originCountry: 'Эфиопия',
          intensity: 8,
          bitterness: 2,
          acidity: 4,
          roast: 2,
          density: 3,
        }}
        onClose={() => undefined}
        onAddToCart={onAddToCart}
      />,
    )

    await user.click(screen.getByRole('button', { name: CART_COPY.increaseQty }))
    await user.click(screen.getByRole('button', { name: CART_COPY.addCta }))

    expect(onAddToCart).toHaveBeenCalledWith('p1', 2)
  })
})

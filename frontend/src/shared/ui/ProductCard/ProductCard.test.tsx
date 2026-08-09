import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ProductCard } from '@shared/ui/ProductCard'

describe('ProductCard', () => {
  it('calls onExpand from the keyboard-reachable title control', async () => {
    const user = userEvent.setup()
    const onExpand = vi.fn()

    render(
      <ProductCard
        id="p1"
        categoryLabel="Кофе"
        title="Эфиопия"
        images={[]}
        price="890 ₽"
        onExpand={onExpand}
      />,
    )

    screen.getByRole('button', { name: 'Эфиопия' }).focus()
    await user.keyboard('{Enter}')

    expect(onExpand).toHaveBeenCalledWith('p1')
  })

  it('does not expand when cart or favorite is clicked', async () => {
    const user = userEvent.setup()
    const onExpand = vi.fn()
    const onAddToCart = vi.fn()
    const onToggleFavorite = vi.fn()

    render(
      <ProductCard
        id="p1"
        categoryLabel="Кофе"
        title="Эфиопия"
        images={[]}
        price="890 ₽"
        onExpand={onExpand}
        onAddToCart={onAddToCart}
        onToggleFavorite={onToggleFavorite}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'В корзину' }))
    await user.click(screen.getByRole('button', { name: 'В избранное' }))

    expect(onAddToCart).toHaveBeenCalledWith('p1')
    expect(onToggleFavorite).toHaveBeenCalledWith('p1')
    expect(onExpand).not.toHaveBeenCalled()
  })

  it('disables the cart button when the product is out of stock', () => {
    render(
      <ProductCard
        id="p1"
        categoryLabel="Кофе"
        title="Эфиопия"
        images={[]}
        price="890 ₽"
        inStock={false}
      />,
    )

    expect(screen.getByRole('button', { name: 'В корзину' })).toBeDisabled()
    expect(screen.getByText('Нет в наличии')).toBeInTheDocument()
  })
})

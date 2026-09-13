import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CART_COPY, FAVORITE_COPY } from '@shared/lib/copy'
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

    await user.click(screen.getByRole('button', { name: CART_COPY.add }))
    await user.click(screen.getByRole('button', { name: FAVORITE_COPY.add }))

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

    expect(screen.getByRole('button', { name: CART_COPY.add })).toBeDisabled()
    expect(screen.getByText(CART_COPY.outOfStock)).toBeInTheDocument()
  })

  it('shows a quantity stepper instead of add when cartQuantity > 0', async () => {
    const user = userEvent.setup()
    const onCartQuantityChange = vi.fn()
    const onExpand = vi.fn()

    render(
      <ProductCard
        id="p1"
        categoryLabel="Кофе"
        title="Эфиопия"
        images={[]}
        price="890 ₽"
        cartQuantity={2}
        onExpand={onExpand}
        onCartQuantityChange={onCartQuantityChange}
      />,
    )

    expect(
      screen.queryByRole('button', { name: CART_COPY.add }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: CART_COPY.increaseQty }))
    expect(onCartQuantityChange).toHaveBeenCalledWith('p1', 3)

    await user.click(screen.getByRole('button', { name: CART_COPY.decreaseQty }))
    expect(onCartQuantityChange).toHaveBeenCalledWith('p1', 1)
    expect(onExpand).not.toHaveBeenCalled()
  })

  it('removes the line when quantity is decreased to zero', async () => {
    const user = userEvent.setup()
    const onCartQuantityChange = vi.fn()

    render(
      <ProductCard
        id="p1"
        categoryLabel="Кофе"
        title="Эфиопия"
        images={[]}
        price="890 ₽"
        cartQuantity={1}
        onCartQuantityChange={onCartQuantityChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: CART_COPY.decreaseQty }))
    expect(onCartQuantityChange).toHaveBeenCalledWith('p1', 0)
  })
})

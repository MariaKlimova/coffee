import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@shared/lib/test/renderWithProviders'
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
  it('keeps linked media, carousel controls, cart and favorites separate from title navigation', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const { router, container } = renderWithProviders(
      <ProductCard
        id="linked"
        categoryLabel="Кофе"
        title="Эфиопия"
        images={['/a.jpg', '/b.jpg']}
        price="890 ₽"
        href="/product/ethiopia"
        onExpand={onOpen}
      />,
      { initialEntries: ['/coffee'] },
    )
    expect(container.querySelector('a button, button a, a a')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Следующее фото' }))
    expect(screen.getByRole('img')).toHaveAttribute('src', '/b.jpg')
    await user.click(screen.getByRole('button', { name: CART_COPY.add }))
    await user.click(screen.getByRole('button', { name: FAVORITE_COPY.add }))
    expect(router.state.location.pathname).toBe('/coffee')
    expect(onOpen).not.toHaveBeenCalled()
    const title = screen
      .getAllByRole('link', { name: 'Эфиопия' })
      .find((link) => link.tabIndex !== -1)!
    title.focus()
    await user.keyboard('{Enter}')
    expect(router.state.location.pathname).toBe('/product/ethiopia')
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('swipes linked media without navigating, then allows a normal image tap', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const { router } = renderWithProviders(
      <ProductCard
        id="linked"
        categoryLabel="Кофе"
        title="Эфиопия"
        images={['/a.jpg', '/b.jpg']}
        price="890 ₽"
        href="/product/ethiopia"
        onExpand={onOpen}
      />,
      { initialEntries: ['/coffee'] },
    )
    const image = screen.getByRole('img')
    const start = { clientX: 220, clientY: 100, identifier: 1 }
    const end = { clientX: 100, clientY: 100, identifier: 1 }
    fireEvent.touchStart(image, { touches: [start], changedTouches: [start] })
    fireEvent.touchEnd(image, { touches: [], changedTouches: [end] })
    await user.click(image)
    expect(router.state.location.pathname).toBe('/coffee')
    expect(onOpen).not.toHaveBeenCalled()
    expect(image).toHaveAttribute('src', '/b.jpg')
    fireEvent.touchStart(image, { touches: [end], changedTouches: [end] })
    fireEvent.touchEnd(image, { touches: [], changedTouches: [end] })
    await user.click(image)
    expect(router.state.location.pathname).toBe('/product/ethiopia')
    expect(onOpen).toHaveBeenCalledOnce()
  })
})

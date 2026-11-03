import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ImageCarousel } from './ImageCarousel'

const images = ['/first.webp', '/second.webp', '/third.webp']
const touch = (clientX: number, clientY: number, identifier = 1) => ({
  clientX,
  clientY,
  identifier,
})

function setup(linked = false) {
  const onImageOpen = vi.fn()
  render(
    <MemoryRouter>
      <ImageCarousel
        images={images}
        alt="Кофе"
        imageHref={linked ? '/product/coffee' : undefined}
        onImageOpen={onImageOpen}
      />
    </MemoryRouter>,
  )
  const carousel = screen.getByRole('group', { name: 'Кофе' })
  const start = touch(200, 200)
  const swipe = (x: number, y: number) => {
    fireEvent.touchStart(carousel, { touches: [start], changedTouches: [start] })
    fireEvent.touchEnd(carousel, { touches: [], changedTouches: [touch(x, y)] })
  }
  return { carousel, swipe, onImageOpen }
}

describe('ImageCarousel gestures', () => {
  it('changes images only for a horizontal gesture beyond the threshold', () => {
    const { swipe } = setup()
    swipe(130, 190)
    expect(screen.getByRole('img')).toHaveAttribute('src', images[1])
    swipe(270, 210)
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0])
    swipe(175, 200)
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0])
  })

  it.each([
    [130, 60],
    [270, 340],
    [130, 130],
  ])(
    'keeps the current image for vertical or equal diagonal motion (%i,%i)',
    (x, y) => {
      const { swipe } = setup()
      swipe(x, y)
      expect(screen.getByRole('img')).toHaveAttribute('src', images[0])
    },
  )

  it('discards cancelled and multi-touch gestures', () => {
    const { carousel } = setup()
    const start = touch(200, 200)
    fireEvent.touchStart(carousel, { touches: [start], changedTouches: [start] })
    fireEvent.touchCancel(carousel)
    fireEvent.touchEnd(carousel, { changedTouches: [touch(100, 200)] })
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0])
    fireEvent.touchStart(carousel, {
      touches: [start, touch(220, 200, 2)],
      changedTouches: [touch(220, 200, 2)],
    })
    fireEvent.touchEnd(carousel, { changedTouches: [touch(100, 200, 2)] })
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0])
  })

  it('suppresses image navigation after a swipe but allows the next tap', () => {
    const { swipe, onImageOpen } = setup(true)
    swipe(130, 190)
    fireEvent.click(screen.getByRole('link'))
    expect(onImageOpen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link'))
    expect(onImageOpen).toHaveBeenCalledOnce()
  })

  it('preserves arrow buttons, dots and keyboard navigation', async () => {
    const user = userEvent.setup()
    const { carousel } = setup()
    await user.click(screen.getByRole('button', { name: 'Следующее фото' }))
    expect(screen.getByRole('img')).toHaveAttribute('src', images[1])
    await user.click(screen.getByRole('button', { name: 'Фото 3' }))
    expect(screen.getByRole('img')).toHaveAttribute('src', images[2])
    carousel.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('img')).toHaveAttribute('src', images[0])
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('img')).toHaveAttribute('src', images[2])
    await user.click(screen.getByRole('button', { name: 'Предыдущее фото' }))
    expect(screen.getByRole('img')).toHaveAttribute('src', images[1])
  })
})

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { Button } from '@shared/ui/Button'

describe('Button', () => {
  it('renders primary label', () => {
    render(<Button>В корзину</Button>)

    expect(screen.getByRole('button', { name: 'В корзину' })).toBeInTheDocument()
  })

  it('disables the control when disabled', () => {
    render(<Button disabled>Сохранить</Button>)

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
  })

  it('exposes busy state while loading', () => {
    render(<Button loading>Отправить</Button>)

    const button = screen.getByRole('button', { name: 'Отправить' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('renders as a link when `to` is set', () => {
    render(
      <MemoryRouter>
        <Button to="/coffee">Вернуться в каталог</Button>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Вернуться в каталог' })).toHaveAttribute(
      'href',
      '/coffee',
    )
  })
})

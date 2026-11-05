import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

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

  it('оставляет нативный переход к якорю текущей страницы без React Router и передаёт anchor event', () => {
    const click = vi.fn()
    render(
      <Button
        href="#contacts"
        onClick={(event) => {
          click(event.currentTarget.tagName)
          expect(event.currentTarget.href).toContain('#contacts')
        }}
      >
        Связаться с магазином
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Связаться с магазином' })
    expect(link).toHaveAttribute('href', '#contacts')
    expect(link).not.toHaveAttribute('data-discover')
    expect(fireEvent.click(link)).toBe(true)
    expect(click).toHaveBeenCalledWith('A')
  })

  it.each(['disabled', 'loading'] as const)(
    'нативная ссылка %s блокирует переход и пользовательский обработчик',
    (state) => {
      const click = vi.fn()
      render(
        <Button
          href="#contacts"
          disabled={state === 'disabled'}
          loading={state === 'loading'}
          onClick={click}
        >
          Связаться с магазином
        </Button>,
      )
      const link = screen.getByRole('link', { name: 'Связаться с магазином' })
      expect(link).toHaveAttribute('aria-disabled', 'true')
      expect(link).toHaveAttribute('tabindex', '-1')
      if (state === 'loading') expect(link).toHaveAttribute('aria-busy', 'true')
      expect(fireEvent.click(link)).toBe(false)
      expect(click).not.toHaveBeenCalled()
    },
  )
})

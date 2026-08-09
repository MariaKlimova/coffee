import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { Header } from '@shared/ui/Header'

describe('Header', () => {
  it('shows login for a guest', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
  })

  it('shows account menu for an authenticated user', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()

    render(
      <MemoryRouter>
        <Header user={{ name: 'Маша' }} onLogout={onLogout} />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Маша' }))
    expect(screen.getByRole('menuitem', { name: 'Профиль' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Мои заказы' })).toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: 'Выйти' }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('formats counter badges for 0, single digit and clamped values', () => {
    const { rerender } = render(
      <MemoryRouter>
        <Header favoritesCount={0} cartCount={9} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Избранное: 0' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Корзина: 9' })).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <Header favoritesCount={0} cartCount={150} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Корзина: 99+' })).toBeInTheDocument()
  })

  it('submits the search query', async () => {
    const user = userEvent.setup()
    const onSearchSubmit = vi.fn()

    render(
      <MemoryRouter>
        <Header onSearchSubmit={onSearchSubmit} />
      </MemoryRouter>,
    )

    await user.type(screen.getByRole('searchbox', { name: 'Поиск' }), 'эфиопия')
    await user.keyboard('{Enter}')

    expect(onSearchSubmit).toHaveBeenCalledWith('эфиопия')
  })
})

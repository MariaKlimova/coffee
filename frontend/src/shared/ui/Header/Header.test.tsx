import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { Header } from '@shared/ui/Header'

describe('Header', () => {
  it('keeps one owner entry in primary navigation with profile and logout in the account', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <MemoryRouter>
        <Header user={{ name: 'Владелец' }} shoppingEnabled={false} managementEnabled />
      </MemoryRouter>,
    )
    expect(
      screen
        .getAllByRole('link', { name: 'Управление' })
        .every((link) => link.getAttribute('href') === '/manage'),
    ).toBe(true)
    expect(screen.getAllByRole('link', { name: 'Управление' })).toHaveLength(1)
    expect(
      within(screen.getByRole('navigation', { name: 'Основная навигация' })).getByRole(
        'link',
        { name: 'Управление' },
      ),
    ).toHaveAttribute('href', '/manage')
    expect(
      screen.queryByRole('link', { name: /Корзина|Избранное|Заказы/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Владелец' }))
    expect(
      screen.queryByRole('menuitem', { name: 'Управление' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Управление' })).toHaveLength(1)
    expect(screen.getByRole('menuitem', { name: 'Профиль' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Выйти' })).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'Мои заказы' }),
    ).not.toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <Header
          user={{ name: 'Покупатель' }}
          shoppingEnabled
          managementEnabled={false}
        />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: 'Управление' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Корзина: 0' })).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'Управление' }),
    ).not.toBeInTheDocument()
  })

  it('offers the same single management entry when the primary menu opens', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Header user={{ name: 'Владелец' }} shoppingEnabled={false} managementEnabled />
      </MemoryRouter>,
    )
    const trigger = screen.getByRole('button', { name: 'Меню' })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const management = screen.getByRole('link', { name: 'Управление' })
    expect(management).toHaveAttribute('href', '/manage')
    await user.click(management)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByRole('link', { name: 'Управление' })).toHaveLength(1)
  })

  it('shows login for a guest', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Заказы' })).toHaveAttribute(
      'href',
      '/orders',
    )
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
    expect(screen.getByRole('menuitem', { name: 'Профиль' })).toHaveAttribute(
      'href',
      '/profile',
    )
    expect(screen.getByRole('menuitem', { name: 'Мои заказы' })).toHaveAttribute(
      'href',
      '/orders',
    )

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

  it('keeps focus on the selected link while the navigation disclosure is closed', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Кофемашины' })
    await user.click(link)
    expect(link).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Меню' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('closes navigation after choosing a section and restores the trigger focus', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )
    const trigger = screen.getByRole('button', { name: 'Меню' })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('link', { name: 'Кофемашины' }))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Контакты' })).toHaveAttribute(
      'href',
      '#contacts',
    )
  })

  it('restores menu focus after native contact anchor navigation without scrolling back', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/machines?search=espresso')
    render(
      <MemoryRouter initialEntries={['/machines?search=espresso']}>
        <Header />
        <p id="contacts">Тестовые контакты</p>
      </MemoryRouter>,
    )
    const trigger = screen.getByRole('button', { name: 'Меню' })
    const focus = vi.spyOn(trigger, 'focus')
    await user.click(trigger)
    await user.click(screen.getByRole('link', { name: 'Контакты' }))
    await waitFor(() => {
      expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    })
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(window.location.pathname).toBe('/machines')
    expect(window.location.search).toBe('?search=espresso')
    expect(window.location.hash).toBe('#contacts')
    window.history.replaceState(null, '', '/')
  })

  it('closes navigation on Escape and when focus leaves it', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )
    const trigger = screen.getByRole('button', { name: 'Меню' })
    await user.click(trigger)
    screen.getByRole('link', { name: 'Кофе' }).focus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    await user.click(screen.getByRole('searchbox', { name: 'Поиск' }))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps the full long account name accessible and supports keyboard menu navigation', async () => {
    const user = userEvent.setup()
    const name = 'Оченьдлинноеимябезпробелов Оченьдлиннаяфамилия'
    render(
      <MemoryRouter>
        <Header user={{ name }} favoritesCount={150} cartCount={999} />
      </MemoryRouter>,
    )
    const trigger = screen.getByRole('button', { name })
    await user.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Профиль' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Мои заказы' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: 'Выйти' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: 'Профиль' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Избранное: 99+' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Корзина: 99+' })).toBeInTheDocument()
  })
})

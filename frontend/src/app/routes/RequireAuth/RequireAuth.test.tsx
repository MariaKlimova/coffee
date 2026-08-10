import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@entities/user'

import { RequireAuth } from './RequireAuth'

function renderPrivateRoute(initialPath = '/favorites') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route element={<RequireAuth />}>
          <Route
            path="/favorites"
            element={<div data-testid="private-page">Favorites</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'idle',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
  })

  it('shows a loading status while auth is restoring', () => {
    useAuthStore.setState({ status: 'restoring' })
    renderPrivateRoute()
    expect(screen.getByRole('status')).toHaveTextContent('Загрузка…')
    expect(screen.queryByTestId('private-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('redirects guests to /login and keeps the original location', () => {
    useAuthStore.setState({ status: 'guest' })
    renderPrivateRoute('/favorites')
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('renders private content for authenticated users', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: {
        id: 'u1',
        email: 'masha@example.com',
        first_name: 'Маша',
        last_name: '',
      },
    })
    renderPrivateRoute()
    expect(screen.getByTestId('private-page')).toBeInTheDocument()
  })
})

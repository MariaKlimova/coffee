import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@entities/user'
import { AUTH_COPY } from '@features/auth'

import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'guest',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
  })

  it('renders the login form for guests', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: AUTH_COPY.loginTitle }),
    ).toBeInTheDocument()
  })

  it('redirects authenticated users away from the login page', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: {
        id: 'u1',
        email: 'masha@example.com',
        first_name: 'Маша',
      },
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div data-testid="home">Home</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('home')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: AUTH_COPY.loginTitle }),
    ).not.toBeInTheDocument()
  })

  it('redirects authenticated users to the saved path from location state', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: {
        id: 'u1',
        email: 'masha@example.com',
      },
    })

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            state: {
              from: {
                pathname: '/favorites',
                search: '',
                hash: '',
                state: null,
                key: 'default',
              },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/favorites"
            element={<div data-testid="favorites">Favorites</div>}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('favorites')).toBeInTheDocument()
  })
})

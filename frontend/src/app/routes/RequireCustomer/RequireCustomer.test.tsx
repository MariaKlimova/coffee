import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@entities/user'
import { AUTH_COPY } from '@shared/lib/copy'
import { RequireCustomer } from './RequireCustomer'

function Destination() {
  const location = useLocation()
  return <h1>{location.pathname}</h1>
}

function renderCustomer(path = '/cart') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/manage" element={<Destination />} />
        <Route element={<RequireCustomer />}>
          <Route path="*" element={<h1>buyer page</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireCustomer', () => {
  beforeEach(() =>
    useAuthStore.setState({
      status: 'guest',
      user: null,
      accessToken: null,
      refreshToken: null,
    }),
  )
  it.each([
    '/cart',
    '/favorites',
    '/checkout',
    '/checkout/result?order_id=test',
    '/orders',
    '/orders/test',
  ])('redirects owner direct %s without mounting buyer content', (path) => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'owner', email: 'owner@example.invalid', is_staff: true },
    })
    renderCustomer(path)
    expect(screen.getByRole('heading', { name: '/manage' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'buyer page' }),
    ).not.toBeInTheDocument()
  })
  it.each(['idle', 'restoring'] as const)(
    'waits for %s before mounting any buyer page',
    (status) => {
      useAuthStore.setState({ status })
      renderCustomer()
      expect(screen.getByRole('status')).toHaveTextContent(AUTH_COPY.loading)
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    },
  )
  it.each(['guest', 'authenticated'] as const)('preserves %s shopping', (status) => {
    useAuthStore.setState({
      status,
      user:
        status === 'authenticated'
          ? { id: 'buyer', email: 'buyer@example.invalid' }
          : null,
    })
    renderCustomer()
    expect(screen.getByRole('heading', { name: 'buyer page' })).toBeInTheDocument()
  })
})

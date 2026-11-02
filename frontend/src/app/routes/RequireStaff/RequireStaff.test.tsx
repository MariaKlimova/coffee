import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@entities/user'
import { getRedirectPath } from '@features/auth'
import { LoginPage } from '@pages/LoginPage'
import { ManageProductEditPage } from '@pages/ManageProductEditPage'
import { APP_ROUTES } from '@shared/config'
import { AUTH_COPY, MANAGE_COPY } from '@shared/lib/copy'

import { RequireStaff } from './RequireStaff'

function LoginDestination() {
  const location = useLocation()
  return <div data-testid="login-destination">{getRedirectPath(location.state)}</div>
}

function renderManage(path = '/manage') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={APP_ROUTES.login} element={<LoginDestination />} />
        <Route element={<RequireStaff />}>
          <Route path={APP_ROUTES.manage} element={<div>private management</div>} />
          <Route
            path={APP_ROUTES.manageProducts}
            element={<div>private management</div>}
          />
          <Route
            path={APP_ROUTES.manageProductNew}
            element={<div>private management</div>}
          />
          <Route
            path={APP_ROUTES.manageProductEdit}
            element={<div>private management</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function authenticate(isStaff?: boolean) {
  useAuthStore.setState({
    status: 'authenticated',
    accessToken: 'test-access',
    refreshToken: 'test-refresh',
    user: { id: 'test-user', email: 'test@example.invalid', is_staff: isStaff },
  })
}

const paths = [
  '/manage',
  '/manage/products',
  '/manage/products/new',
  '/manage/products/test-product/edit',
]

describe('RequireStaff', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'guest',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
  })

  it.each(['idle', 'restoring'] as const)(
    'waits while authentication is %s',
    (status) => {
      useAuthStore.setState({ status })
      renderManage()
      expect(screen.getByRole('status')).toHaveTextContent(AUTH_COPY.loading)
      expect(screen.queryByText('private management')).not.toBeInTheDocument()
    },
  )

  it.each(paths)('keeps the guest return path for %s', (path) => {
    renderManage(`${path}?tab=photos#details`)
    expect(screen.getByTestId('login-destination')).toHaveTextContent(
      `${path}?tab=photos#details`,
    )
    expect(screen.queryByText('private management')).not.toBeInTheDocument()
  })

  it.each(paths)('denies a buyer at %s', (path) => {
    authenticate(false)
    renderManage(path)
    expect(
      screen.getByRole('heading', { name: MANAGE_COPY.deniedTitle }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: MANAGE_COPY.storefront })).toHaveAttribute(
      'href',
      APP_ROUTES.coffee,
    )
    expect(screen.queryByText('private management')).not.toBeInTheDocument()
  })

  it('fails closed for an older API without is_staff', () => {
    authenticate()
    renderManage()
    expect(
      screen.getByRole('heading', { name: MANAGE_COPY.deniedTitle }),
    ).toBeInTheDocument()
  })

  it.each(paths)('admits staff at %s', (path) => {
    authenticate(true)
    renderManage(path)
    expect(screen.getByText('private management')).toBeInTheDocument()
  })

  it('removes protected content after a session is cleared', () => {
    authenticate(true)
    renderManage()
    act(() => {
      useAuthStore.getState().clearSession()
    })
    expect(screen.getByTestId('login-destination')).toHaveTextContent('/manage')
    expect(screen.queryByText('private management')).not.toBeInTheDocument()
  })

  it('returns from the real login page to the requested management page', async () => {
    render(
      <MemoryRouter
        initialEntries={['/manage/products/test-product/edit?tab=photos#details']}
      >
        <Routes>
          <Route path={APP_ROUTES.login} element={<LoginPage />} />
          <Route element={<RequireStaff />}>
            <Route
              path={APP_ROUTES.manageProductEdit}
              element={<ManageProductEditPage />}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: AUTH_COPY.loginTitle }),
    ).toBeInTheDocument()
    act(() => {
      authenticate(true)
    })
    expect(
      await screen.findByRole('heading', { name: MANAGE_COPY.editTitle }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: AUTH_COPY.loginTitle }),
    ).not.toBeInTheDocument()
  })
})

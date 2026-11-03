import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosHeaders } from 'axios'
import { http } from '@shared/api'
import { ToastProvider } from '@shared/ui/Toast'

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

const originalAdapter = http.defaults.adapter
afterEach(() => {
  http.defaults.adapter = originalAdapter
})

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
    http.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      data: {
        id: 'test-product',
        name: 'Кофе',
        category: 'coffee',
        short_description: 'Описание',
        description: '',
        price: '450.00',
        old_price: null,
        stock_quantity: 3,
        reserved_quantity: 0,
        available_quantity: 3,
        is_published: true,
        origin: 'owner',
        attributes: {},
        images: [],
      },
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
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
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
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

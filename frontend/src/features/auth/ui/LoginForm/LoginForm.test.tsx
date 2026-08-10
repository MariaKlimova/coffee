import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bindAuthBridge, useAuthStore } from '@entities/user'
import { resetAuthBridge } from '@shared/api'
import { http } from '@shared/api/http'

import { AUTH_COPY } from '../../auth.const'
import { LoginForm } from './LoginForm'

function jsonResponse(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
): AxiosResponse {
  return {
    data,
    status,
    statusText: String(status),
    headers: {},
    config,
  }
}

function renderLoginForm(onSuccess = vi.fn()) {
  render(
    <MemoryRouter>
      <LoginForm onSuccess={onSuccess} />
    </MemoryRouter>,
  )
  return onSuccess
}

describe('LoginForm', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
    localStorage.clear()
    useAuthStore.setState({
      status: 'guest',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
    bindAuthBridge()
  })

  afterEach(() => {
    resetAuthBridge()
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('calls login and onSuccess for a valid submit', async () => {
    const user = userEvent.setup()
    const onSuccess = renderLoginForm()

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        access: 'access-1',
        refresh: 'refresh-1',
        user: {
          id: 'u1',
          email: 'masha@example.com',
          first_name: 'Маша',
        },
      }),
    )

    await user.type(screen.getByLabelText(AUTH_COPY.emailLabel), 'masha@example.com')
    await user.type(screen.getByLabelText(AUTH_COPY.passwordLabel), 'password12')
    await user.click(screen.getByRole('button', { name: AUTH_COPY.loginSubmit }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(useAuthStore.getState().status).toBe('authenticated')
  })

  it('shows a form-level error on 401 and keeps the form mounted', async () => {
    const user = userEvent.setup()
    renderLoginForm()

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError(
        'Unauthorized',
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        jsonResponse(config, 401, {
          detail: 'No active account found with the given credentials.',
          code: 'authentication_failed',
        }),
      )
    })

    await user.type(screen.getByLabelText(AUTH_COPY.emailLabel), 'masha@example.com')
    await user.type(screen.getByLabelText(AUTH_COPY.passwordLabel), 'password12')
    await user.click(screen.getByRole('button', { name: AUTH_COPY.loginSubmit }))

    expect(await screen.findByRole('alert')).toHaveTextContent(AUTH_COPY.loginFailed)
    expect(
      screen.getByRole('button', { name: AUTH_COPY.loginSubmit }),
    ).toBeInTheDocument()
  })

  it('does not send a second request while submitting', async () => {
    const user = userEvent.setup()
    renderLoginForm()

    let resolveRequest!: (value: AxiosResponse) => void
    const pending = new Promise<AxiosResponse>((resolve) => {
      resolveRequest = resolve
    })

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      return pending.then(() =>
        jsonResponse(config, 200, {
          access: 'access-1',
          refresh: 'refresh-1',
          user: { id: 'u1', email: 'masha@example.com' },
        }),
      )
    })

    await user.type(screen.getByLabelText(AUTH_COPY.emailLabel), 'masha@example.com')
    await user.type(screen.getByLabelText(AUTH_COPY.passwordLabel), 'password12')

    const submit = screen.getByRole('button', { name: AUTH_COPY.loginSubmit })
    await user.click(submit)
    await user.click(submit)

    expect(adapter).toHaveBeenCalledTimes(1)
    resolveRequest(
      jsonResponse({} as InternalAxiosRequestConfig, 200, {
        access: 'access-1',
        refresh: 'refresh-1',
        user: { id: 'u1', email: 'masha@example.com' },
      }),
    )
  })
})

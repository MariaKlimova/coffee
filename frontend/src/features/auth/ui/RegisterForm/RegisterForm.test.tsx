import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bindAuthBridge, useAuthStore } from '@entities/user'
import { resetAuthBridge } from '@shared/api'
import { http } from '@shared/api/http'

import { AUTH_COPY } from '../../auth.const'
import { RegisterForm } from './RegisterForm'

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

describe('RegisterForm', () => {
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

  it('validates mismatched passwords before calling the API', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()

    render(
      <MemoryRouter>
        <RegisterForm onSuccess={onSuccess} />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(AUTH_COPY.emailLabel), 'masha@example.com')
    await user.type(screen.getByLabelText(AUTH_COPY.passwordLabel), 'password12')
    await user.type(screen.getByLabelText(AUTH_COPY.passwordConfirmLabel), 'password99')
    await user.click(screen.getByRole('button', { name: AUTH_COPY.registerSubmit }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      AUTH_COPY.passwordMismatch,
    )
    expect(adapter).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('shows a taken email under the email field', async () => {
    const user = userEvent.setup()

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw new AxiosError(
        'Bad Request',
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        jsonResponse(config, 400, {
          detail: 'Invalid input',
          code: 'validation_error',
          errors: { email: ['A user with this email already exists.'] },
        }),
      )
    })

    render(
      <MemoryRouter>
        <RegisterForm onSuccess={vi.fn()} />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(AUTH_COPY.emailLabel), 'masha@example.com')
    await user.type(screen.getByLabelText(AUTH_COPY.passwordLabel), 'password12')
    await user.type(screen.getByLabelText(AUTH_COPY.passwordConfirmLabel), 'password12')
    await user.click(screen.getByRole('button', { name: AUTH_COPY.registerSubmit }))

    await waitFor(() => {
      expect(screen.getByLabelText(AUTH_COPY.emailLabel)).toHaveAttribute(
        'aria-invalid',
        'true',
      )
    })
    expect(screen.getByRole('alert')).toHaveTextContent(AUTH_COPY.emailTaken)
  })

  it('does not send a second request while submitting', async () => {
    const user = userEvent.setup()

    let resolveRequest!: (value: AxiosResponse) => void
    const pending = new Promise<AxiosResponse>((resolve) => {
      resolveRequest = resolve
    })

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      return pending.then(() =>
        jsonResponse(config, 201, {
          access: 'access-1',
          refresh: 'refresh-1',
          user: { id: 'u1', email: 'masha@example.com' },
        }),
      )
    })

    render(
      <MemoryRouter>
        <RegisterForm onSuccess={vi.fn()} />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(AUTH_COPY.emailLabel), 'masha@example.com')
    await user.type(screen.getByLabelText(AUTH_COPY.passwordLabel), 'password12')
    await user.type(screen.getByLabelText(AUTH_COPY.passwordConfirmLabel), 'password12')

    const submit = screen.getByRole('button', {
      name: AUTH_COPY.registerSubmit,
    })
    await user.click(submit)
    await user.click(submit)

    expect(adapter).toHaveBeenCalledTimes(1)
    resolveRequest(
      jsonResponse({} as InternalAxiosRequestConfig, 201, {
        access: 'access-1',
        refresh: 'refresh-1',
        user: { id: 'u1', email: 'masha@example.com' },
      }),
    )
  })
})

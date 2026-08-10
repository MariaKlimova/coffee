import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bindAuthBridge, useAuthStore } from '@entities/user'
import { AUTH_COPY } from '@features/auth'
import { resetAuthBridge } from '@shared/api'
import { http } from '@shared/api/http'

import { ProfilePage } from './ProfilePage'

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

describe('ProfilePage', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
    localStorage.clear()
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: {
        id: 'u1',
        email: 'masha@example.com',
        first_name: 'Маша',
        last_name: '',
      },
    })
    bindAuthBridge()
  })

  afterEach(() => {
    resetAuthBridge()
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('shows the current user email and logs out', async () => {
    const user = userEvent.setup()

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 204, null),
    )

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: AUTH_COPY.profileTitle }),
    ).toBeInTheDocument()
    expect(screen.getByText('masha@example.com')).toBeInTheDocument()
    expect(screen.getByText('Маша')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: AUTH_COPY.logout }))

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('guest')
    })
    expect(useAuthStore.getState().user).toBeNull()
  })
})

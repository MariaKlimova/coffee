import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetAuthBridge } from '@shared/api'
import { http } from '@shared/api/http'

import { clearRefreshToken, readRefreshToken, REFRESH_TOKEN_KEY } from './authStorage'
import { bindAuthBridge, useAuthStore } from './authStore'

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

function unauthorizedError(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError(
    'Unauthorized',
    AxiosError.ERR_BAD_REQUEST,
    config,
    null,
    jsonResponse(config, 401, {
      detail: 'Token is invalid or expired.',
      code: 'token_not_valid',
    }),
  )
}

describe('authStore', () => {
  const adapter = vi.fn()

  beforeEach(() => {
    adapter.mockReset()
    http.defaults.adapter = adapter
    localStorage.clear()
    useAuthStore.setState({
      status: 'idle',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
    bindAuthBridge()
  })

  afterEach(() => {
    clearRefreshToken()
    resetAuthBridge()
    delete http.defaults.adapter
    vi.restoreAllMocks()
  })

  it('stores refresh token in localStorage on login', async () => {
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 200, {
        access: 'access-1',
        refresh: 'refresh-1',
        user: {
          id: 'u1',
          email: 'masha@example.com',
          first_name: 'Маша',
          last_name: '',
        },
      }),
    )

    await useAuthStore.getState().login({
      email: 'masha@example.com',
      password: 'password12',
    })

    const state = useAuthStore.getState()
    expect(state.status).toBe('authenticated')
    expect(state.accessToken).toBe('access-1')
    expect(state.refreshToken).toBe('refresh-1')
    expect(state.user?.email).toBe('masha@example.com')
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1')
  })

  it('clears session and localStorage on logout', async () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1')
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

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      jsonResponse(config, 204, null),
    )

    await useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.status).toBe('guest')
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
    expect(state.user).toBeNull()
    expect(readRefreshToken()).toBeNull()
  })

  it('restores session via refresh + /me/ and keeps access token', async () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-ok')
    useAuthStore.setState({
      status: 'idle',
      accessToken: null,
      refreshToken: 'refresh-ok',
      user: null,
    })

    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { access: 'access-restored' },
    })

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (!config.headers.Authorization) {
        throw unauthorizedError(config)
      }
      return jsonResponse(config, 200, {
        id: 'u1',
        email: 'masha@example.com',
        first_name: 'Маша',
      })
    })

    await useAuthStore.getState().restoreSession()

    const state = useAuthStore.getState()
    expect(state.status).toBe('authenticated')
    expect(state.accessToken).toBe('access-restored')
    expect(state.user?.email).toBe('masha@example.com')
    expect(readRefreshToken()).toBe('refresh-ok')
  })

  it('moves to guest when restoreSession refresh fails', async () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-broken')
    useAuthStore.setState({
      status: 'idle',
      accessToken: null,
      refreshToken: 'refresh-broken',
      user: null,
    })

    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh failed'))

    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw unauthorizedError(config)
    })

    await useAuthStore.getState().restoreSession()

    const state = useAuthStore.getState()
    expect(state.status).toBe('guest')
    expect(state.user).toBeNull()
    expect(readRefreshToken()).toBeNull()
  })
})

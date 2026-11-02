import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAuthBridge, resetAuthBridge } from '@shared/api'
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
      sessionGeneration: 0,
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

  it('clears every stale credential and advances identity when restore has no refresh token', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'stale-access',
      user: { id: 'a', email: 'a@example.invalid' },
    })
    const identity = getAuthBridge().getSessionIdentity?.()
    await useAuthStore.getState().restoreSession()
    expect(useAuthStore.getState()).toMatchObject({
      status: 'guest',
      accessToken: null,
      refreshToken: null,
      user: null,
      sessionGeneration: 1,
    })
    expect(getAuthBridge().getSessionIdentity?.()).not.toBe(identity)
    expect(readRefreshToken()).toBeNull()
    expect(adapter).not.toHaveBeenCalled()
  })

  it.each(['success', 'error'] as const)(
    'ignores late restore A %s after logout or a new login',
    async (outcome) => {
      for (const transition of ['logout', 'login B'] as const) {
        const userA = { id: 'a', email: 'a@example.invalid' }
        const userB = { id: 'b', email: 'b@example.invalid' }
        useAuthStore.getState().setSession({
          accessToken: 'access-a',
          refreshToken: 'refresh-a',
          user: userA,
        })
        let release!: () => void
        const gate = new Promise<void>((done) => {
          release = done
        })
        const entered = vi.fn()
        adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
          if (config.url === '/api/auth/me/') {
            entered()
            await gate
            if (outcome === 'error') throw new Error('Late restore A failed')
            return jsonResponse(config, 200, userA)
          }
          if (config.url === '/api/auth/login/')
            return jsonResponse(config, 200, {
              access: 'access-b',
              refresh: 'refresh-b',
              user: userB,
            })
          return jsonResponse(config, 204, null)
        })
        const restoring = useAuthStore.getState().restoreSession()
        await vi.waitFor(() => expect(entered).toHaveBeenCalledTimes(1))
        if (transition === 'logout') await useAuthStore.getState().logout()
        else
          await useAuthStore
            .getState()
            .login({ email: userB.email, password: 'synthetic-password' })
        const afterChange = useAuthStore.getState()
        const storedRefresh = readRefreshToken()
        release()
        await restoring
        expect(useAuthStore.getState()).toEqual(afterChange)
        expect(readRefreshToken()).toBe(storedRefresh)
        expect(getAuthBridge().getSessionIdentity?.()).toBe(
          afterChange.sessionGeneration,
        )
      }
    },
  )

  it('invalidates identity and clears a failed current restore without relying on an HTTP401', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'access-a',
      refreshToken: 'refresh-a',
      user: { id: 'a', email: 'a@example.invalid' },
    })
    const generation = useAuthStore.getState().sessionGeneration
    adapter.mockRejectedValue(new Error('Me unavailable'))
    await useAuthStore.getState().restoreSession()
    expect(useAuthStore.getState()).toMatchObject({
      status: 'guest',
      accessToken: null,
      refreshToken: null,
      user: null,
      sessionGeneration: generation + 1,
    })
    expect(readRefreshToken()).toBeNull()
  })

  it('does not clear a newer login when a previous logout completes late', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'access-a',
      refreshToken: 'refresh-a',
      user: { id: 'a', email: 'a@example.invalid' },
    })
    let release!: () => void
    const gate = new Promise<void>((done) => {
      release = done
    })
    const entered = vi.fn()
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      entered()
      await gate
      return jsonResponse(config, 204, null)
    })
    const loggingOut = useAuthStore.getState().logout()
    await vi.waitFor(() => expect(entered).toHaveBeenCalledTimes(1))
    useAuthStore.getState().setSession({
      accessToken: 'access-b',
      refreshToken: 'refresh-b',
      user: { id: 'b', email: 'b@example.invalid' },
    })
    const newSession = useAuthStore.getState()
    release()
    await loggingOut
    expect(useAuthStore.getState()).toEqual(newSession)
    expect(readRefreshToken()).toBe('refresh-b')
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

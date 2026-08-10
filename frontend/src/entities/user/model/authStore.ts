import { create } from 'zustand'

import { setAuthBridge } from '@shared/api'

import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../api/authApi'
import type { LoginRequest, RegisterRequest } from '../api/authApi.typings'
import { clearRefreshToken, readRefreshToken, writeRefreshToken } from './authStorage'
import type { AuthSession, AuthStoreState } from './authStore.typings'

/**
 * Binds the HTTP auth bridge to this store (clear-only on expiry).
 * App bootstrap (`setupAuthBridge`) is the single compose point that may add redirect.
 * Tests call this after `resetAuthBridge()`.
 */
export function bindAuthBridge(): void {
  setAuthBridge({
    getAccessToken: () => useAuthStore.getState().accessToken,
    getRefreshToken: () => useAuthStore.getState().refreshToken ?? readRefreshToken(),
    onTokenRefreshed: (accessToken) => {
      useAuthStore.setState({ accessToken })
    },
    onSessionExpired: () => {
      useAuthStore.getState().clearSession()
    },
  })
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  status: 'idle',
  accessToken: null,
  refreshToken: readRefreshToken(),
  user: null,

  setSession: (session: AuthSession) => {
    writeRefreshToken(session.refreshToken)
    set({
      status: 'authenticated',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    })
  },

  clearSession: () => {
    clearRefreshToken()
    set({
      status: 'guest',
      accessToken: null,
      refreshToken: null,
      user: null,
    })
  },

  login: async (payload: LoginRequest) => {
    const tokens = await loginRequest(payload)
    get().setSession({
      accessToken: tokens.access,
      refreshToken: tokens.refresh,
      user: tokens.user,
    })
  },

  register: async (payload: RegisterRequest) => {
    const tokens = await registerRequest(payload)
    get().setSession({
      accessToken: tokens.access,
      refreshToken: tokens.refresh,
      user: tokens.user,
    })
  },

  logout: async () => {
    const refresh = get().refreshToken ?? readRefreshToken()
    if (refresh) {
      try {
        await logoutRequest(refresh)
      } catch {
        // Best-effort blacklist; always clear local session.
      }
    }
    get().clearSession()
  },

  restoreSession: async () => {
    const refresh = get().refreshToken ?? readRefreshToken()
    if (!refresh) {
      set({ status: 'guest', refreshToken: null })
      return
    }

    set({ status: 'restoring', refreshToken: refresh })

    try {
      // Access token is missing after F5; the 401 interceptor refreshes it.
      const user = await fetchMe()
      const accessToken = get().accessToken
      if (!accessToken) {
        throw new Error('Missing access token after session restore')
      }
      set({
        status: 'authenticated',
        accessToken,
        user,
        refreshToken: refresh,
      })
    } catch {
      clearRefreshToken()
      set({
        status: 'guest',
        accessToken: null,
        refreshToken: null,
        user: null,
      })
    }
  },
}))

/** Derived selector: true when the user has an active session. */
export const selectIsAuthenticated = (state: AuthStoreState): boolean =>
  state.status === 'authenticated'

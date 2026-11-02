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
    getSessionIdentity: () => useAuthStore.getState().sessionGeneration,
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
  sessionGeneration: 0,
  accessToken: null,
  refreshToken: readRefreshToken(),
  user: null,

  setSession: (session: AuthSession) => {
    writeRefreshToken(session.refreshToken)
    set({
      status: 'authenticated',
      sessionGeneration: get().sessionGeneration + 1,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    })
  },

  clearSession: () => {
    clearRefreshToken()
    set({
      status: 'guest',
      sessionGeneration: get().sessionGeneration + 1,
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
    const generation = get().sessionGeneration
    const refresh = get().refreshToken ?? readRefreshToken()
    if (refresh) {
      try {
        await logoutRequest(refresh)
      } catch {
        // Недоступность отзыва токена не мешает завершить исходную локальную сессию.
      }
    }
    if (get().sessionGeneration === generation) get().clearSession()
  },

  restoreSession: async () => {
    const generation = get().sessionGeneration
    const refresh = get().refreshToken ?? readRefreshToken()
    if (!refresh) {
      get().clearSession()
      return
    }

    set({ status: 'restoring', refreshToken: refresh })

    try {
      // После перезагрузки access token отсутствует; 401 запускает его обновление.
      const user = await fetchMe()
      // Позднее восстановление не вправе заменить более новый вход или выход.
      if (get().sessionGeneration !== generation) return
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
      if (get().sessionGeneration === generation) get().clearSession()
    }
  },
}))

/** Derived selector: true when the user has an active session. */
export const selectIsAuthenticated = (state: AuthStoreState): boolean =>
  state.status === 'authenticated'

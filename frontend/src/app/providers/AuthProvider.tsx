import { type ReactNode, useEffect } from 'react'

import { useAuthStore } from '@entities/user'

interface AuthProviderProps {
  /** Nested application tree. */
  children: ReactNode
}

/**
 * Restores a persisted session on first mount when a refresh token exists.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const restoreSession = useAuthStore((state) => state.restoreSession)
  const status = useAuthStore((state) => state.status)

  useEffect(() => {
    if (status !== 'idle') {
      return
    }
    void restoreSession()
  }, [restoreSession, status])

  return children
}

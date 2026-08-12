import { type ReactNode, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { favoriteKeys } from '@entities/favorite'
import { productKeys } from '@entities/product'
import { useAuthStore } from '@entities/user'

interface AuthProviderProps {
  /** Nested application tree. */
  children: ReactNode
}

/**
 * Restores a persisted session on first mount when a refresh token exists.
 * Invalidates product/favorite caches when auth status settles to guest or
 * authenticated so `is_favorite` flags match the current session.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const restoreSession = useAuthStore((state) => state.restoreSession)
  const status = useAuthStore((state) => state.status)
  const previousStatusRef = useRef(status)

  useEffect(() => {
    if (status !== 'idle') {
      return
    }
    void restoreSession()
  }, [restoreSession, status])

  useEffect(() => {
    const previousStatus = previousStatusRef.current
    previousStatusRef.current = status

    if (previousStatus === status) {
      return
    }
    if (status !== 'authenticated' && status !== 'guest') {
      return
    }

    void queryClient.invalidateQueries({ queryKey: productKeys.all })
    void queryClient.invalidateQueries({ queryKey: favoriteKeys.all })
  }, [status, queryClient])

  return children
}

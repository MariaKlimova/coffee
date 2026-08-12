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
 * On auth status changes: refreshes product caches so `is_favorite` matches the
 * session, and clears favorite queries on logout so the header count cannot linger.
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

    if (status === 'guest') {
      // Drop favorites cache so the header count cannot linger after logout.
      queryClient.removeQueries({ queryKey: favoriteKeys.all })
      return
    }

    void queryClient.invalidateQueries({ queryKey: favoriteKeys.all })
  }, [status, queryClient])

  return children
}

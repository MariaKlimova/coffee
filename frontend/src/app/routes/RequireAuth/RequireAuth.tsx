import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '@entities/user'

/**
 * Pathless layout that blocks guests from private routes until auth settles.
 */
export function RequireAuth() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'idle' || status === 'restoring') {
    return (
      <div role="status" aria-live="polite">
        Загрузка…
      </div>
    )
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

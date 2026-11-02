import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '@entities/user'
import { ManageAccessDeniedPage } from '@pages/ManageAccessDeniedPage'
import { APP_ROUTES } from '@shared/config'
import { AUTH_COPY } from '@shared/lib/copy'

/** Защищает все вложенные страницы управления до отображения их содержимого. */
export function RequireStaff() {
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  if (status === 'idle' || status === 'restoring') {
    return (
      <div role="status" aria-live="polite">
        {AUTH_COPY.loading}
      </div>
    )
  }
  if (status !== 'authenticated') {
    return <Navigate to={APP_ROUTES.login} replace state={{ from: location }} />
  }
  if (user?.is_staff !== true) {
    return <ManageAccessDeniedPage />
  }
  return <Outlet />
}

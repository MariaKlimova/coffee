import { Navigate, Outlet } from 'react-router-dom'

import { selectAccountMode, useAuthStore } from '@entities/user'
import { APP_ROUTES } from '@shared/config'
import { AUTH_COPY } from '@shared/lib/copy'

/** Покупательские страницы не открываются владельцу, включая прямые ссылки. */
export function RequireCustomer() {
  const mode = useAuthStore(selectAccountMode)
  if (mode === 'pending')
    return (
      <div role="status" aria-live="polite">
        {AUTH_COPY.loading}
      </div>
    )
  if (mode === 'owner') return <Navigate to={APP_ROUTES.manage} replace />
  return <Outlet />
}

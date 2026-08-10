import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuthStore } from '@entities/user'

import { AUTH_COPY } from '../../auth.const'
import { getRedirectPath } from '../../lib/getRedirectPath'
import type { GuestAuthPageProps } from './GuestAuthPage.typings'
import styles from './GuestAuthPage.module.css'

/**
 * Shared shell for /login and /register: wait for restore, bounce authed users,
 * then render the guest form with a post-success redirect.
 */
export function GuestAuthPage({ children, className }: GuestAuthPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const status = useAuthStore((state) => state.status)
  const redirectTo = getRedirectPath(location.state)

  if (status === 'idle' || status === 'restoring') {
    return (
      <div className={styles.GuestAuthPage} role="status" aria-live="polite">
        {AUTH_COPY.loading}
      </div>
    )
  }

  if (status === 'authenticated') {
    return <Navigate to={redirectTo} replace />
  }

  return (
    <div className={className ?? styles.GuestAuthPage}>
      {children({
        onSuccess: () => {
          void navigate(redirectTo, { replace: true })
        },
      })}
    </div>
  )
}

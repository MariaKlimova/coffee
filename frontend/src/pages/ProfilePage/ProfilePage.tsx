import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getUserDisplayName, useAuthStore } from '@entities/user'
import { AUTH_COPY, AuthCard } from '@features/auth'
import { Button } from '@shared/ui/Button'

import styles from './ProfilePage.module.css'

export function ProfilePage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  if (!user) {
    return (
      <div role="status" aria-live="polite">
        {AUTH_COPY.loading}
      </div>
    )
  }

  const displayName = getUserDisplayName(user)
  const hasName = Boolean(user.first_name?.trim())

  async function handleLogout() {
    if (isLoggingOut) {
      return
    }
    setIsLoggingOut(true)
    try {
      await logout()
      void navigate('/', { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <AuthCard title={AUTH_COPY.profileTitle}>
      <dl className={styles['ProfilePage-List']}>
        <div className={styles['ProfilePage-Row']}>
          <dt className={styles['ProfilePage-Label']}>{AUTH_COPY.profileEmailLabel}</dt>
          <dd className={styles['ProfilePage-Value']}>{user.email}</dd>
        </div>
        <div className={styles['ProfilePage-Row']}>
          <dt className={styles['ProfilePage-Label']}>{AUTH_COPY.profileNameLabel}</dt>
          <dd className={styles['ProfilePage-Value']}>
            {hasName ? displayName : AUTH_COPY.profileNameEmpty}
          </dd>
        </div>
      </dl>
      <Button
        variant="secondary"
        loading={isLoggingOut}
        onClick={() => {
          void handleLogout()
        }}
      >
        {AUTH_COPY.logout}
      </Button>
    </AuthCard>
  )
}

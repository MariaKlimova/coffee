import { Outlet } from 'react-router-dom'

import { getUserDisplayName, useAuthStore } from '@entities/user'
import { Footer } from '@shared/ui/Footer'
import { Header } from '@shared/ui/Header'

import styles from './RootLayout.module.css'

/**
 * App shell for store pages: sticky header, page content, footer.
 * Cart/favorites counts stay stubbed until their epics wire real data.
 */
export function RootLayout() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  return (
    <div className={styles.RootLayout}>
      <Header
        favoritesCount={0}
        cartCount={0}
        user={user ? { name: getUserDisplayName(user) } : null}
        onLogout={() => {
          void logout()
        }}
      />
      <main className={styles['RootLayout-Main']}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

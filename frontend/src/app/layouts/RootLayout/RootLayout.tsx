import { Outlet } from 'react-router-dom'

import { useCart } from '@entities/cart'
import { useFavoritesCount } from '@entities/favorite'
import { getUserDisplayName, useAuthStore } from '@entities/user'
import { Footer } from '@shared/ui/Footer'
import { Header } from '@shared/ui/Header'

import styles from './RootLayout.module.css'

/**
 * App shell for store pages: sticky header, page content, footer.
 */
export function RootLayout() {
  const user = useAuthStore((state) => state.user)
  const status = useAuthStore((state) => state.status)
  const logout = useAuthStore((state) => state.logout)
  const favoritesCountQuery = useFavoritesCount()
  const favoritesCount =
    status === 'authenticated' ? (favoritesCountQuery.data ?? 0) : 0
  const cartQuery = useCart()
  const cartCount = cartQuery.data?.items_count ?? 0

  return (
    <div className={styles.RootLayout}>
      <Header
        favoritesCount={favoritesCount}
        cartCount={cartCount}
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

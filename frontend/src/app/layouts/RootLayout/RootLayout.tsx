import { Outlet } from 'react-router-dom'

import { Footer } from '@shared/ui/Footer'
import { Header } from '@shared/ui/Header'

import styles from './RootLayout.module.css'

/**
 * App shell for store pages: sticky header, page content, footer.
 * Auth and cart/favorites counts are stubbed until Epic 2.
 */
export function RootLayout() {
  return (
    <div className={styles.RootLayout}>
      <Header favoritesCount={0} cartCount={0} user={null} />
      <main className={styles['RootLayout-Main']}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

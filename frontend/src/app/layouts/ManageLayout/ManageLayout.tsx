import { Link, NavLink, Outlet } from 'react-router-dom'

import { APP_ROUTES } from '@shared/config'
import { MANAGE_COPY } from '@shared/lib/copy'

import styles from './ManageLayout.module.css'

/** Минимальная оболочка управления без элементов покупательской корзины. */
export function ManageLayout() {
  return (
    <div className={styles.ManageLayout}>
      <header className={styles['ManageLayout-Header']}>
        <Link className={styles['ManageLayout-Title']} to={APP_ROUTES.manage}>
          {MANAGE_COPY.title}
        </Link>
        <nav
          className={styles['ManageLayout-Navigation']}
          aria-label={MANAGE_COPY.navigation}
        >
          <NavLink
            className={styles['ManageLayout-Link']}
            to={APP_ROUTES.manageProducts}
          >
            {MANAGE_COPY.productsTitle}
          </NavLink>
          <Link className={styles['ManageLayout-Link']} to={APP_ROUTES.coffee}>
            {MANAGE_COPY.storefront}
          </Link>
        </nav>
      </header>
      <main className={styles['ManageLayout-Main']}>
        <Outlet />
      </main>
    </div>
  )
}

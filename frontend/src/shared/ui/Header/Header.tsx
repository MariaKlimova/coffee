import { Link } from 'react-router-dom'

import { APP_ROUTES } from '@shared/config'
import { CART_PAGE_COPY, FAVORITES_PAGE_COPY } from '@shared/lib/copy'
import { cx } from '@shared/lib/cx'
import { HeartIcon } from '@shared/ui/icons'

import { HeaderAccount } from './Header-Account'
import { HeaderCounterLink } from './Header-CounterLink'
import { HeaderSearch } from './Header-Search'
import { HeaderNavigation } from './Header-Navigation'
import type { HeaderProps } from './Header.typings'
import styles from './Header.module.css'

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h2l1.5 10h11L21 8H8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="19" r="1.25" fill="currentColor" />
      <circle cx="17" cy="19" r="1.25" fill="currentColor" />
    </svg>
  )
}

export function Header({
  favoritesCount = 0,
  cartCount = 0,
  user = null,
  onSearchSubmit,
  onLogout,
  className,
}: HeaderProps) {
  return (
    <header className={cx(styles.Header, className)}>
      <div className={styles['Header-Inner']}>
        <Link to={APP_ROUTES.coffee} className={styles['Header-Brand']}>
          Coffee Shop
        </Link>

        <div className={styles['Header-SearchRow']}>
          <HeaderNavigation />
          <div className={styles['Header-SearchSlot']}>
            <HeaderSearch onSubmit={onSearchSubmit} />
          </div>
        </div>

        <div className={styles['Header-Actions']}>
          <HeaderCounterLink
            to={APP_ROUTES.favorites}
            label={FAVORITES_PAGE_COPY.title}
            count={favoritesCount}
            icon={<HeartIcon />}
          />
          <HeaderCounterLink
            to={APP_ROUTES.cart}
            label={CART_PAGE_COPY.title}
            count={cartCount}
            icon={<CartIcon />}
          />
          <HeaderAccount user={user} onLogout={onLogout} />
        </div>
      </div>
    </header>
  )
}

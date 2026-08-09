import { Link, NavLink } from 'react-router-dom'

import { cx } from '@shared/lib/cx'

import { HeaderAccount } from './Header-Account'
import { HeaderCounterLink } from './Header-CounterLink'
import { HeaderSearch } from './Header-Search'
import { HEADER_NAV_ITEMS } from './Header.const'
import type { HeaderProps } from './Header.typings'
import styles from './Header.module.css'

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20s-7-4.35-7-9.2A3.8 3.8 0 0 1 12 7.2a3.8 3.8 0 0 1 7 3.6C19 15.65 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
        <Link to="/" className={styles['Header-Brand']}>
          Coffee Shop
        </Link>

        <nav className={styles['Header-Nav']} aria-label="Основная навигация">
          <ul className={styles['Header-NavList']}>
            {HEADER_NAV_ITEMS.map((item) => {
              const isHashLink = item.to.includes('#')
              return (
                <li key={item.to}>
                  {isHashLink ? (
                    <a href={item.to} className={styles['Header-NavLink']}>
                      {item.label}
                    </a>
                  ) : (
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cx(
                          styles['Header-NavLink'],
                          isActive && styles['Header-NavLink--active'],
                        )
                      }
                      end={item.to === '/'}
                    >
                      {item.label}
                    </NavLink>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <HeaderSearch onSubmit={onSearchSubmit} />

        <div className={styles['Header-Actions']}>
          <HeaderCounterLink
            to="/favorites"
            label="Избранное"
            count={favoritesCount}
            icon={<HeartIcon />}
          />
          <HeaderCounterLink
            to="/cart"
            label="Корзина"
            count={cartCount}
            icon={<CartIcon />}
          />
          <HeaderAccount user={user} onLogout={onLogout} />
        </div>
      </div>
    </header>
  )
}

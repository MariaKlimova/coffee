import { useId } from 'react'
import { NavLink } from 'react-router-dom'

import { APP_ROUTES } from '@shared/config'
import { NAV_COPY, MANAGE_COPY } from '@shared/lib/copy'
import { cx } from '@shared/lib/cx'

import { HEADER_NAV_ITEMS } from '../Header.const'
import { useHeaderDisclosure } from '../lib'
import type { HeaderNavigationProps } from './Header-Navigation.typings'
import styles from './Header-Navigation.module.css'

export function HeaderNavigation({
  catalogSearch = '',
  shoppingEnabled = true,
  managementEnabled = false,
}: HeaderNavigationProps) {
  const { open, setOpen, rootRef, triggerRef, closeAndRestoreFocus } =
    useHeaderDisclosure()
  const navigationId = useId()
  const items = HEADER_NAV_ITEMS.filter(
    (item) => shoppingEnabled || item.to !== APP_ROUTES.orders,
  )
  if (managementEnabled) items.push({ to: APP_ROUTES.manage, label: MANAGE_COPY.entry })

  return (
    <div ref={rootRef} className={styles['Header-Navigation']}>
      <button
        ref={triggerRef}
        type="button"
        className={styles['Header-NavigationTrigger']}
        aria-expanded={open}
        aria-controls={navigationId}
        onClick={() => setOpen((value) => !value)}
      >
        {NAV_COPY.menu}
      </button>
      <nav
        id={navigationId}
        className={cx(
          styles['Header-NavigationPanel'],
          open && styles['Header-NavigationPanel--open'],
        )}
        aria-label={NAV_COPY.primaryNavigation}
      >
        <ul className={styles['Header-NavigationList']}>
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={
                  item.to === APP_ROUTES.coffee || item.to === APP_ROUTES.machines
                    ? `${item.to}${catalogSearch}`
                    : item.to
                }
                className={({ isActive }) =>
                  cx(
                    styles['Header-NavigationLink'],
                    isActive && styles['Header-NavigationLink--active'],
                  )
                }
                onClick={closeAndRestoreFocus}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

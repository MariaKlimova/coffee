import { useEffect, useId, useRef } from 'react'
import { NavLink } from 'react-router-dom'

import { NAV_COPY } from '@shared/lib/copy'
import { cx } from '@shared/lib/cx'

import { HEADER_NAV_ITEMS } from '../Header.const'
import { useHeaderDisclosure } from '../lib'
import styles from './Header-Navigation.module.css'

export function HeaderNavigation() {
  const { open, setOpen, rootRef, triggerRef, closeAndRestoreFocus } =
    useHeaderDisclosure()
  const navigationId = useId()
  const anchorFocusFrame = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (anchorFocusFrame.current !== null) {
        window.cancelAnimationFrame(anchorFocusFrame.current)
      }
    },
    [],
  )

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
          {HEADER_NAV_ITEMS.map((item) => (
            <li key={item.to}>
              {item.to.includes('#') ? (
                <a
                  href={item.to}
                  className={styles['Header-NavigationLink']}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    ) {
                      return
                    }
                    closeAndRestoreFocus()
                    if (open) {
                      // Якорь сначала прокручивает страницу и меняет фокус нативно.
                      // Возвращаем фокус после этого, сохраняя положение контактов.
                      anchorFocusFrame.current = window.requestAnimationFrame(() => {
                        triggerRef.current?.focus({ preventScroll: true })
                        anchorFocusFrame.current = null
                      })
                    }
                  }}
                >
                  {item.label}
                </a>
              ) : (
                <NavLink
                  to={item.to}
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
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

import { useEffect, useId, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { APP_ROUTES } from '@shared/config'
import { AUTH_COPY, ORDERS_PAGE_COPY } from '@shared/lib/copy'
import { cx } from '@shared/lib/cx'
import { Button } from '@shared/ui/Button'

import { useHeaderDisclosure } from '../lib'
import type { HeaderAccountProps } from './Header-Account.typings'
import styles from './Header-Account.module.css'

export function HeaderAccount({ user, onLogout, className }: HeaderAccountProps) {
  const { open, setOpen, rootRef, triggerRef, closeAndRestoreFocus } =
    useHeaderDisclosure()
  const menuRef = useRef<HTMLUListElement>(null)
  const menuId = useId()
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    }
  }, [open])

  if (!user) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={cx(styles['Header-AccountTrigger'], className)}
        onClick={() => {
          void navigate(APP_ROUTES.login)
        }}
      >
        {AUTH_COPY.loginSubmit}
      </Button>
    )
  }

  return (
    <div ref={rootRef} className={cx(styles['Header-Account'], className)}>
      <button
        ref={triggerRef}
        id={`${menuId}-trigger`}
        type="button"
        className={styles['Header-AccountTrigger']}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        <span className={styles['Header-AccountName']} title={user.name}>
          {user.name}
        </span>
      </button>
      {open ? (
        <ul
          ref={menuRef}
          id={menuId}
          className={styles['Header-AccountMenu']}
          role="menu"
          aria-labelledby={`${menuId}-trigger`}
          onKeyDown={(event) => {
            const items = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
            )
            const index = items.indexOf(document.activeElement as HTMLElement)
            let nextIndex = index
            if (event.key === 'ArrowDown') nextIndex = (index + 1) % items.length
            else if (event.key === 'ArrowUp')
              nextIndex = (index - 1 + items.length) % items.length
            else if (event.key === 'Home') nextIndex = 0
            else if (event.key === 'End') nextIndex = items.length - 1
            else return
            event.preventDefault()
            items[nextIndex]?.focus()
          }}
        >
          <li role="none">
            <Link
              to={APP_ROUTES.profile}
              role="menuitem"
              className={styles['Header-AccountItem']}
              onClick={closeAndRestoreFocus}
            >
              {AUTH_COPY.profileTitle}
            </Link>
          </li>
          <li role="none">
            <Link
              to={APP_ROUTES.orders}
              role="menuitem"
              className={styles['Header-AccountItem']}
              onClick={closeAndRestoreFocus}
            >
              {ORDERS_PAGE_COPY.title}
            </Link>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={styles['Header-AccountItem']}
              onClick={() => {
                closeAndRestoreFocus()
                onLogout?.()
              }}
            >
              {AUTH_COPY.logout}
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  )
}

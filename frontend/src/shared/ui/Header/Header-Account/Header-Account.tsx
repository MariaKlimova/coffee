import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { cx } from '@shared/lib/cx'
import { Button } from '@shared/ui/Button'

import type { HeaderAccountProps } from './Header-Account.typings'
import styles from './Header-Account.module.css'

export function HeaderAccount({ user, onLogout, className }: HeaderAccountProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) {
      return
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!user) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={className}
        onClick={() => {
          void navigate('/login')
        }}
      >
        Войти
      </Button>
    )
  }

  return (
    <div ref={rootRef} className={cx(styles['Header-Account'], className)}>
      <button
        type="button"
        className={styles['Header-AccountTrigger']}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        {user.name}
      </button>
      {open ? (
        <ul id={menuId} className={styles['Header-AccountMenu']} role="menu">
          <li role="none">
            <Link
              to="/#profile"
              role="menuitem"
              className={styles['Header-AccountItem']}
              onClick={() => {
                setOpen(false)
              }}
            >
              Профиль
            </Link>
          </li>
          <li role="none">
            <Link
              to="/#orders"
              role="menuitem"
              className={styles['Header-AccountItem']}
              onClick={() => {
                setOpen(false)
              }}
            >
              Мои заказы
            </Link>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={styles['Header-AccountItem']}
              onClick={() => {
                setOpen(false)
                onLogout?.()
              }}
            >
              Выйти
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  )
}

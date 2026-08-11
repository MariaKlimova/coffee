import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cx } from '@shared/lib/cx'

import type { ButtonProps } from './Button.typings'
import styles from './Button.module.css'

function ButtonContent({
  loading,
  iconLeft,
  iconRight,
  children,
}: {
  /** Whether the spinner is shown. */
  loading: boolean
  /** Optional leading icon. */
  iconLeft?: ReactNode
  /** Optional trailing icon. */
  iconRight?: ReactNode
  /** Label. */
  children?: ReactNode
}) {
  return (
    <>
      {loading ? <span className={styles['Button-Spinner']} aria-hidden /> : null}
      {!loading && iconLeft ? (
        <span className={styles['Button-Icon']} aria-hidden>
          {iconLeft}
        </span>
      ) : null}
      {children ? (
        <span
          className={cx(
            styles['Button-Label'],
            loading && styles['Button-Label--hidden'],
          )}
        >
          {children}
        </span>
      ) : null}
      {!loading && iconRight ? (
        <span className={styles['Button-Icon']} aria-hidden>
          {iconRight}
        </span>
      ) : null}
    </>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  children,
  className,
  type = 'button',
  to,
  onClick,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  const classNames = cx(
    styles.Button,
    styles[`Button--${variant}`],
    styles[`Button--${size}`],
    loading && styles['Button--loading'],
    className,
  )
  const content = (
    <ButtonContent loading={loading} iconLeft={iconLeft} iconRight={iconRight}>
      {children}
    </ButtonContent>
  )

  if (to) {
    return (
      <Link
        to={to}
        className={classNames}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        tabIndex={isDisabled ? -1 : undefined}
        onClick={(event) => {
          if (isDisabled) {
            event.preventDefault()
            return
          }
          onClick?.(event as never)
        }}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      {...rest}
      type={type}
      className={classNames}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

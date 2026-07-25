import { cx } from '@shared/lib/cx'

import type { ButtonProps } from './Button.typings'
import styles from './Button.module.css'

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
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      {...rest}
      type={type}
      className={cx(
        styles.Button,
        styles[`Button--${variant}`],
        styles[`Button--${size}`],
        loading && styles['Button--loading'],
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
    >
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
    </button>
  )
}

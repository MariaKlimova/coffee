import { cx } from '@shared/lib/cx'

import type { BadgeProps } from './Badge.typings'
import styles from './Badge.module.css'

export function Badge({
  variant = 'neutral',
  children,
  className,
  ...rest
}: BadgeProps) {
  return (
    <span
      {...rest}
      className={cx(styles.Badge, styles[`Badge--${variant}`], className)}
    >
      {children}
    </span>
  )
}

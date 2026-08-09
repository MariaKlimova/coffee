import { Link } from 'react-router-dom'

import { cx } from '@shared/lib/cx'

import { formatHeaderCount } from '../Header.const'
import type { HeaderCounterLinkProps } from './Header-CounterLink.typings'
import styles from './Header-CounterLink.module.css'

export function HeaderCounterLink({
  to,
  label,
  count,
  icon,
  className,
}: HeaderCounterLinkProps) {
  const displayCount = formatHeaderCount(count)

  return (
    <Link
      to={to}
      className={cx(styles['Header-CounterLink'], className)}
      aria-label={`${label}: ${displayCount}`}
    >
      <span className={styles['Header-CounterLinkIcon']} aria-hidden>
        {icon}
      </span>
      <span className={styles['Header-Counter']} aria-hidden>
        {displayCount}
      </span>
    </Link>
  )
}

import { cx } from '@shared/lib/cx'

import type { EmptyStateProps } from './EmptyState.typings'
import styles from './EmptyState.module.css'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx(styles.EmptyState, className)}>
      {icon ? <div className={styles['EmptyState-Icon']}>{icon}</div> : null}
      <h2 className={styles['EmptyState-Title']}>{title}</h2>
      {description ? (
        <p className={styles['EmptyState-Description']}>{description}</p>
      ) : null}
      {action ? <div className={styles['EmptyState-Action']}>{action}</div> : null}
    </div>
  )
}

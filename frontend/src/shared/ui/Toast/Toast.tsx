import { cx } from '@shared/lib/cx'

import type { ToastProps } from './Toast.typings'
import styles from './Toast.module.css'

export function Toast({ message, variant, onClose }: ToastProps) {
  return (
    <div className={cx(styles.Toast, styles[`Toast--${variant}`])}>
      <span className={styles['Toast-Message']}>{message}</span>
      <button
        type="button"
        className={styles['Toast-Close']}
        aria-label="Закрыть уведомление"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  )
}

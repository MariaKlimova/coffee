import { cx } from '@shared/lib/cx'

import type { ScaleRowProps } from './ScaleRow.typings'
import styles from './ScaleRow.module.css'

export function ScaleRow({ label, value, max }: ScaleRowProps) {
  const clamped = Math.max(0, Math.min(max, value))
  const segments = Array.from({ length: max }, (_, index) => index < clamped)

  return (
    <div className={styles.ScaleRow}>
      <span className={styles['ScaleRow-Label']}>{label}</span>
      <div className={styles['ScaleRow-Track']} aria-hidden>
        {segments.map((filled, index) => (
          <span
            key={index}
            className={cx(
              styles['ScaleRow-Segment'],
              filled && styles['ScaleRow-Segment--filled'],
            )}
          />
        ))}
      </div>
      <span className={styles['ScaleRow-Value']}>
        {clamped}/{max}
      </span>
    </div>
  )
}

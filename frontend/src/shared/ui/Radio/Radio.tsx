import { useId } from 'react'

import { cx } from '@shared/lib/cx'
import choiceStyles from '@shared/ui/choice/choiceControl.module.css'

import type { RadioProps } from './Radio.typings'
import styles from './Radio.module.css'

export function Radio({
  label,
  error = false,
  className,
  id,
  disabled,
  ...rest
}: RadioProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <label
      className={cx(
        styles.Radio,
        error && styles['Radio--error'],
        disabled && styles['Radio--disabled'],
        className,
      )}
      htmlFor={fieldId}
    >
      <input
        {...rest}
        id={fieldId}
        type="radio"
        className={cx(choiceStyles.visuallyHidden, styles['Radio-Input'])}
        disabled={disabled}
        aria-invalid={error || undefined}
      />
      <span className={styles['Radio-Dot']} aria-hidden />
      <span className={styles['Radio-Label']}>{label}</span>
    </label>
  )
}

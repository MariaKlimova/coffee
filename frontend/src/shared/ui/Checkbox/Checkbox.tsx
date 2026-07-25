import { useId } from 'react'

import { cx } from '@shared/lib/cx'
import choiceStyles from '@shared/ui/choice/choiceControl.module.css'

import type { CheckboxProps } from './Checkbox.typings'
import styles from './Checkbox.module.css'

export function Checkbox({
  label,
  error = false,
  className,
  id,
  disabled,
  ...rest
}: CheckboxProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <label
      className={cx(
        styles.Checkbox,
        error && styles['Checkbox--error'],
        disabled && styles['Checkbox--disabled'],
        className,
      )}
      htmlFor={fieldId}
    >
      <input
        {...rest}
        id={fieldId}
        type="checkbox"
        className={cx(choiceStyles.visuallyHidden, styles['Checkbox-Input'])}
        disabled={disabled}
        aria-invalid={error || undefined}
      />
      <span className={styles['Checkbox-Box']} aria-hidden />
      <span className={styles['Checkbox-Label']}>{label}</span>
    </label>
  )
}

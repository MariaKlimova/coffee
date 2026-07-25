import { cx } from '@shared/lib/cx'
import { FieldFeedback, useFieldA11y } from '@shared/ui/field'

import type { InputProps } from './Input.typings'
import styles from './Input.module.css'

export function Input({
  label,
  helperText,
  errorText,
  icon,
  className,
  id,
  disabled,
  ...rest
}: InputProps) {
  const { fieldId, hintId, errorId, hasError, describedBy } = useFieldA11y({
    id,
    helperText,
    errorText,
  })

  return (
    <div
      className={cx(
        styles.Input,
        hasError && styles['Input--error'],
        disabled && styles['Input--disabled'],
        className,
      )}
    >
      {label ? (
        <label className={styles['Input-Label']} htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <div className={styles['Input-Control']}>
        {icon ? (
          <span className={styles['Input-Icon']} aria-hidden>
            {icon}
          </span>
        ) : null}
        <input
          {...rest}
          id={fieldId}
          className={styles['Input-Field']}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
        />
      </div>
      <FieldFeedback
        hasError={hasError}
        errorText={errorText}
        helperText={helperText}
        errorId={errorId}
        hintId={hintId}
      />
    </div>
  )
}

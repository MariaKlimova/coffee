import { cx } from '@shared/lib/cx'
import { FieldFeedback, useFieldA11y } from '@shared/ui/field'

import type { SelectProps } from './Select.typings'
import styles from './Select.module.css'

export function Select({
  label,
  helperText,
  errorText,
  options,
  placeholder,
  className,
  id,
  disabled,
  value,
  defaultValue,
  ...rest
}: SelectProps) {
  const { fieldId, hintId, errorId, hasError, describedBy } = useFieldA11y({
    id,
    helperText,
    errorText,
  })

  return (
    <div
      className={cx(
        styles.Select,
        hasError && styles['Select--error'],
        disabled && styles['Select--disabled'],
        className,
      )}
    >
      {label ? (
        <label className={styles['Select-Label']} htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <select
        {...rest}
        id={fieldId}
        className={styles['Select-Field']}
        disabled={disabled}
        value={value}
        defaultValue={defaultValue ?? (placeholder ? '' : undefined)}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

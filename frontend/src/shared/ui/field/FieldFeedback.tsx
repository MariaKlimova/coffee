import type { FieldFeedbackProps } from './FieldFeedback.typings'
import styles from './FieldFeedback.module.css'

export function FieldFeedback({
  hasError,
  errorText,
  helperText,
  errorId,
  hintId,
}: FieldFeedbackProps) {
  if (hasError) {
    return (
      <p className={styles['FieldFeedback-Error']} id={errorId} role="alert">
        {errorText}
      </p>
    )
  }

  if (!helperText) {
    return null
  }

  return (
    <p className={styles['FieldFeedback-Hint']} id={hintId}>
      {helperText}
    </p>
  )
}

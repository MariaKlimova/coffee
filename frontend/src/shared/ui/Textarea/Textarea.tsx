import { FieldFeedback, useFieldA11y } from '@shared/ui/field'
import type { TextareaProps } from './Textarea.typings'
import styles from './Textarea.module.css'
export function Textarea({ label, errorText, id, ...props }: TextareaProps) {
  const { fieldId, errorId, hintId, hasError, describedBy } = useFieldA11y({
    id,
    errorText,
  })
  return (
    <div className={styles.Textarea}>
      <label htmlFor={fieldId}>{label}</label>
      <textarea
        {...props}
        id={fieldId}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
      />
      <FieldFeedback
        hasError={hasError}
        errorText={errorText}
        errorId={errorId}
        hintId={hintId}
      />
    </div>
  )
}

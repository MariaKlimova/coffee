import { useId } from 'react'

/**
 * Accessibility ids and describedBy for labeled form fields.
 */
export interface FieldA11y {
  /** Id of the control (input/select). */
  fieldId: string
  /** Id of the helper text element. */
  hintId: string
  /** Id of the error text element. */
  errorId: string
  /** Whether errorText is present. */
  hasError: boolean
  /** aria-describedby value for the control. */
  describedBy: string | undefined
}

/**
 * Builds stable field ids and aria-describedBy for Input/Select-like controls.
 */
export function useFieldA11y(options: {
  /** Explicit control id; falls back to React useId. */
  id?: string
  /** Helper text under the field. */
  helperText?: string
  /** Error text under the field. */
  errorText?: string
}): FieldA11y {
  const generatedId = useId()
  const fieldId = options.id ?? generatedId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`
  const hasError = Boolean(options.errorText)

  let describedBy: string | undefined
  if (hasError) {
    describedBy = errorId
  } else if (options.helperText) {
    describedBy = hintId
  }

  return { fieldId, hintId, errorId, hasError, describedBy }
}

/**
 * Props for shared field feedback messages.
 */
export interface FieldFeedbackProps {
  /** Whether the field is in error state. */
  hasError: boolean
  /** Error message shown with role=alert. */
  errorText?: string
  /** Helper message when there is no error. */
  helperText?: string
  /** DOM id for the error element. */
  errorId: string
  /** DOM id for the helper element. */
  hintId: string
}

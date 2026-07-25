import type { InputHTMLAttributes, ReactNode } from 'react'

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size'
> {
  /** Visible label above the field. */
  label?: string
  /** Helper text under the field when there is no error. */
  helperText?: string
  /** Error message; marks the field invalid when set. */
  errorText?: string
  /** Optional leading icon (for example search). */
  icon?: ReactNode
}

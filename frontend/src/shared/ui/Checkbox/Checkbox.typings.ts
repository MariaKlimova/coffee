import type { InputHTMLAttributes, ReactNode } from 'react'

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  /** Visible label next to the checkbox. */
  label: ReactNode
  /** Marks the field as invalid visually. */
  error?: boolean
}

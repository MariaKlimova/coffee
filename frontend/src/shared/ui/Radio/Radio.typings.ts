import type { InputHTMLAttributes, ReactNode } from 'react'

export interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  /** Visible label next to the radio. */
  label: ReactNode
  /** Marks the field as invalid visually. */
  error?: boolean
}

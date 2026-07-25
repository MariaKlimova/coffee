import type { SelectHTMLAttributes } from 'react'

/**
 * One option in a Select list.
 */
export interface SelectOption {
  /** Option value submitted with the form. */
  value: string
  /** Visible label for the option. */
  label: string
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  /** Visible label above the field. */
  label?: string
  /** Helper text under the field when there is no error. */
  helperText?: string
  /** Error message; marks the field invalid when set. */
  errorText?: string
  /** Options rendered inside the native select. */
  options: SelectOption[]
  /** Placeholder option shown when value is empty. */
  placeholder?: string
}

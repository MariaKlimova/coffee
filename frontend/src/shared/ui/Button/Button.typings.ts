import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Visual style of the button.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

/**
 * Control size of the button.
 */
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Defaults to primary. */
  variant?: ButtonVariant
  /** Control size. Defaults to md. */
  size?: ButtonSize
  /** Shows a spinner and disables interaction. */
  loading?: boolean
  /** Optional icon rendered before the label. */
  iconLeft?: ReactNode
  /** Optional icon rendered after the label. */
  iconRight?: ReactNode
  /** Button label / content. */
  children?: ReactNode
}

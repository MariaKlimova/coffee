import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from 'react'

/**
 * Visual style of the button.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

/**
 * Control size of the button.
 */
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonVisualProps {
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

interface ButtonControlProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>, ButtonVisualProps {
  /** Native button type. Ignored when `to` is set. */
  type?: 'button' | 'submit' | 'reset'
  /**
   * When set, renders a React Router link with the same button styles
   * (for empty-state CTAs and similar navigational actions).
   */
  to?: string
  /** Нативная ссылка задаётся отдельным режимом и не совмещается с `to`. */
  href?: never
}

interface ButtonAnchorProps extends ButtonVisualProps {
  /** Нативный адрес, в том числе якорь текущей страницы. */
  href: string
  /** Нативная ссылка не совмещается с маршрутом React Router. */
  to?: never
  /** Тип кнопки не применяется к ссылке. */
  type?: never
  /** Запрещает переход и убирает ссылку из порядка фокуса. */
  disabled?: boolean
  /** Дополнительный класс оформления. */
  className?: string
  /** Обработчик получает настоящий DOM-элемент ссылки. */
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

export type ButtonProps = ButtonControlProps | ButtonAnchorProps

import type { TextareaHTMLAttributes } from 'react'
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Видимая подпись поля. */
  label: string
  /** Понятная ошибка у поля. */
  errorText?: string
}

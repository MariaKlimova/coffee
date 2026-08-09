import type { ReactNode } from 'react'

/**
 * Visual tone of a toast notification.
 */
export type ToastVariant = 'success' | 'error' | 'info'

/**
 * Payload for showing a toast.
 */
export interface ToastShowOptions {
  /** Message text. */
  message: string
  /** Visual tone. Defaults to info. */
  variant?: ToastVariant
  /** Auto-hide delay in ms. Defaults to 3000. */
  durationMs?: number
}

/**
 * Props of a single rendered toast.
 */
export interface ToastProps {
  /** Message text. */
  message: string
  /** Visual tone. */
  variant: ToastVariant
  /** Manual close handler. */
  onClose: () => void
}

/**
 * Props for ToastProvider.
 */
export interface ToastProviderProps {
  /** Application tree that can call useToast. */
  children: ReactNode
}

/**
 * Value exposed through the toast context.
 */
export interface ToastContextValue {
  /** Queues a toast and hides it after its duration. */
  showToast: (options: ToastShowOptions) => void
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Toast } from './Toast'
import { DEFAULT_TOAST_DURATION_MS } from './Toast.const'
import { ToastContext } from './toastContext'
import type {
  ToastProviderProps,
  ToastShowOptions,
  ToastVariant,
} from './Toast.typings'
import styles from './Toast.module.css'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  const timersRef = useRef(new Map<number, number>())

  const hideToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (options: ToastShowOptions) => {
      const id = idRef.current + 1
      idRef.current = id

      setToasts((current) => [
        ...current,
        { id, message: options.message, variant: options.variant ?? 'info' },
      ])

      const timer = window.setTimeout(() => {
        hideToast(id)
      }, options.durationMs ?? DEFAULT_TOAST_DURATION_MS)
      timersRef.current.set(id, timer)
    },
    [hideToast],
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer)
      })
      timers.clear()
    }
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(
            <div className={styles['Toast-Viewport']} role="status">
              {toasts.map((toast) => (
                <Toast
                  key={toast.id}
                  message={toast.message}
                  variant={toast.variant}
                  onClose={() => {
                    hideToast(toast.id)
                  }}
                />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  )
}

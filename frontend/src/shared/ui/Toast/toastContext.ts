import { createContext } from 'react'

import type { ToastContextValue } from './Toast.typings'

export const ToastContext = createContext<ToastContextValue | null>(null)

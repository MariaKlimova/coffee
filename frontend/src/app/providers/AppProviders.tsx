import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@app/providers/AuthProvider'
import { isNotFoundError } from '@shared/api'
import { ToastProvider } from '@shared/ui/Toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A missing resource stays missing: retrying a 404 only delays the empty state.
      retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 1,
      refetchOnWindowFocus: false,
    },
  },
})

interface AppProvidersProps {
  /** Nested application tree. */
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

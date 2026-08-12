import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { favoriteKeys } from '@entities/favorite'
import { useAuthStore } from '@entities/user'

import { AuthProvider } from './AuthProvider'

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    )
  }
}

describe('AuthProvider', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: {
        id: 'u1',
        email: 'a@b.c',
        first_name: 'A',
        last_name: 'B',
      },
    })
  })

  it('removes favorite queries when the session becomes guest', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(favoriteKeys.count(), 5)

    render(<div />, { wrapper: createWrapper(queryClient) })

    act(() => {
      useAuthStore.setState({
        status: 'guest',
        accessToken: null,
        refreshToken: null,
        user: null,
      })
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(favoriteKeys.count())).toBeUndefined()
    })
  })
})

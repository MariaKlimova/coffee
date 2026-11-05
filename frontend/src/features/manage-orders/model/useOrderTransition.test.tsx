import { act, cleanup, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CanceledError } from 'axios'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { bindAuthBridge, useAuthStore } from '@entities/user'
import { http } from '@shared/api'

import { useOrderTransition } from './useOrderTransition'

function staff(id: string) {
  useAuthStore.getState().setSession({
    accessToken: `synthetic-${id}`,
    refreshToken: `synthetic-refresh-${id}`,
    user: { id, email: `${id}@example.invalid`, is_staff: true },
  })
}

afterEach(() => {
  cleanup()
  useAuthStore.getState().clearSession()
  vi.restoreAllMocks()
})

describe('Привязка команды к показанной сотруднику сессии', () => {
  it.each(['staff-a', 'staff-b'])(
    'сохранённый submit не становится действием нового входа %s',
    async (nextActor) => {
      staff('staff-a')
      bindAuthBridge()
      const post = vi.spyOn(http, 'post')
      const client = new QueryClient()
      function Wrapper({ children }: { /** Тестируемый hook. */ children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
      }
      const { result } = renderHook(() => useOrderTransition('synthetic-order'), {
        wrapper: Wrapper,
      })
      const retainedSubmit = result.current.submit
      act(() => staff(nextActor))
      await expect(
        Promise.resolve().then(() =>
          retainedSubmit({
            expected_status: 'paid',
            to_status: 'processing',
            request_id: crypto.randomUUID(),
            comment: 'Старое намерение',
          }),
        ),
      ).rejects.toBeInstanceOf(CanceledError)
      expect(post).not.toHaveBeenCalled()
      expect(client.getQueryCache().getAll()).toHaveLength(0)
      expect(client.getMutationCache().getAll()).toHaveLength(0)
    },
  )
})

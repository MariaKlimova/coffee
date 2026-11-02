import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { FormEvent, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@entities/user'
import { http } from '@shared/api'
import { useCheckoutSubmit } from './useCheckoutSubmit'
import { usePayOrder } from './usePayOrder'

describe('owner checkout boundary', () => {
  afterEach(() => {
    delete http.defaults.adapter
  })
  it('does not create an order or payment even if an old buyer callback is invoked for staff', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'owner', email: 'owner@example.invalid', is_staff: true },
      accessToken: 'access',
      refreshToken: 'refresh',
    })
    const adapter = vi.fn()
    http.defaults.adapter = adapter
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const redirect = vi.fn()
    const { result } = renderHook(
      () => ({
        checkout: useCheckoutSubmit({ isGuest: false, redirectToPayment: redirect }),
        payment: usePayOrder({ redirectToPayment: redirect }),
      }),
      { wrapper },
    )
    await act(async () => {
      await result.current.checkout.handleSubmit(
        { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>,
        {
          deliveryAddress: 'Synthetic street',
          email: 'owner@example.invalid',
          phone: '+79990000000',
        },
      )
      await result.current.payment.payOrder('old-buyer-order')
    })
    expect(adapter).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
    expect(result.current.checkout.isSubmitting).toBe(false)
    expect(result.current.payment.isPaying).toBe(false)
  })
})

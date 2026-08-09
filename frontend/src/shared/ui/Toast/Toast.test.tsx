import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ToastProvider, useToast } from '@shared/ui/Toast'

function ToastProbe() {
  const { showToast } = useToast()
  return (
    <button
      type="button"
      onClick={() => {
        showToast({ message: 'Добавлено в корзину', variant: 'success' })
      }}
    >
      Показать тост
    </button>
  )
}

function renderWithProbe() {
  render(
    <ToastProvider>
      <ToastProbe />
    </ToastProvider>,
  )

  act(() => {
    screen.getByRole('button', { name: 'Показать тост' }).click()
  })
}

describe('Toast', () => {
  it('shows a toast and hides it after the duration', () => {
    vi.useFakeTimers()
    renderWithProbe()

    expect(screen.getByText('Добавлено в корзину')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByText('Добавлено в корзину')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('hides a toast on manual close', () => {
    vi.useFakeTimers()
    renderWithProbe()

    act(() => {
      screen.getByRole('button', { name: 'Закрыть уведомление' }).click()
    })

    expect(screen.queryByText('Добавлено в корзину')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})

import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { bindAuthBridge, useAuthStore } from '@entities/user'
import { ManageOrderDetailPage } from '@pages/ManageOrderDetailPage'
import { http } from '@shared/api'
import { CANCELLATION_COPY, MANAGE_ORDERS_COPY as copy } from '@shared/lib/copy'
import { renderWithProviders } from '@shared/lib/test/renderWithProviders'

import type {
  CancellationDecisionWrite,
  ManageOrder,
} from '../../api/manageOrdersApi.typings'

const originalAdapter = http.defaults.adapter
const id = 'synthetic-order-71'
const requestId = 'synthetic-request-71'
const initial: ManageOrder = {
  id,
  status: 'paid',
  total: '500.00',
  delivery_address: 'Синтетический адрес',
  items: [],
  created_at: '2026-11-05T10:00:00Z',
  updated_at: '2026-11-05T10:00:00Z',
  customer_email: null,
  customer_phone: null,
  latest_payment_status: 'succeeded',
  payments: [],
  status_history: [],
  allowed_transitions: [
    {
      to_status: 'cancelled',
      inventory_effect: 'restore_stock',
      inventory_reason: null,
    },
  ],
  cancellation_requests: [
    {
      id: requestId,
      reason: 'Изменились планы',
      state: 'open',
      created_at: '2026-11-05T10:00:00Z',
      decided_at: null,
      public_response: '',
      private_comment: '',
      decided_by: null,
    },
  ],
}
function staff(id = 'synthetic-staff-a') {
  useAuthStore.getState().setSession({
    accessToken: `synthetic-access-${id}`,
    refreshToken: `synthetic-refresh-${id}`,
    user: { id, email: 'synthetic@example.invalid', is_staff: true },
  })
}
function response(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: '', headers: new AxiosHeaders() }
}
function setup() {
  return renderWithProviders(
    <Routes>
      <Route path="/manage/orders/:id" element={<ManageOrderDetailPage />} />
    </Routes>,
    { initialEntries: [`/manage/orders/${id}`] },
  )
}
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  staff()
  bindAuthBridge()
})
afterEach(() => {
  http.defaults.adapter = originalAdapter
})

describe('Решение сотрудника по запросу отмены', () => {
  it.each(['accept', 'decline'] as const)(
    '%s использует отдельный публичный ответ и внутренний комментарий, сохраняя UUID при сетевом повторе',
    async (decision) => {
      let current = initial
      const posts: string[] = []
      http.defaults.adapter = async (config) => {
        if (config.method === 'get') return response(config, current)
        expect(config.url).toBe(
          `/api/manage/orders/${id}/cancellation-requests/${requestId}/decision/`,
        )
        posts.push(config.data)
        if (posts.length === 1)
          throw new AxiosError('lost decision response', AxiosError.ERR_NETWORK, config)
        const values = JSON.parse(config.data) as CancellationDecisionWrite
        current = {
          ...initial,
          status: decision === 'accept' ? 'cancelled' : 'paid',
          cancellation_requests: [
            {
              ...initial.cancellation_requests![0],
              state: decision === 'accept' ? 'accepted' : 'declined',
              decided_at: initial.updated_at,
              public_response: values.public_response,
              private_comment: values.private_comment,
              decided_by: { id: 'synthetic-staff-a', label: 'Сотрудник' },
            },
          ],
        }
        return response(config, { order: current, replayed: true })
      }
      const user = userEvent.setup()
      const view = setup()
      await user.click(
        await screen.findByRole('button', {
          name:
            decision === 'accept' ? copy.acceptCancellation : copy.declineCancellation,
        }),
      )
      expect(
        screen.getByRole('heading', { name: copy.confirmCancellationDecision }),
      ).toHaveFocus()
      expect(screen.getByLabelText(copy.publicResponse)).toBeRequired()
      if (decision === 'accept')
        expect(screen.getByText(copy.separateRefund)).toBeVisible()
      else expect(screen.getByText(copy.declineHint)).toBeVisible()
      await user.type(
        screen.getByLabelText(copy.publicResponse),
        '  Ответ покупателю  ',
      )
      await user.type(
        screen.getByLabelText(copy.privateComment),
        '  Только сотрудникам  ',
      )
      await user.click(screen.getByRole('button', { name: copy.confirm }))
      expect(await screen.findByText(copy.transitionError)).toBeVisible()
      view.unmount()
      setup()
      const retry = await screen.findByRole('button', { name: copy.retryTransition })
      await waitFor(() => expect(retry).toBeEnabled())
      await user.click(retry)
      expect(await screen.findByText(copy.decisionSuccess)).toBeVisible()
      expect(posts[1]).toBe(posts[0])
      expect(JSON.parse(posts[0])).toEqual({
        request_id: expect.any(String),
        decision,
        expected_status: 'paid',
        public_response: 'Ответ покупателю',
        private_comment: 'Только сотрудникам',
      })
      expect(JSON.parse(posts[0]).request_id).not.toBe(requestId)
      expect(
        screen.getByText(
          CANCELLATION_COPY[decision === 'accept' ? 'accepted' : 'declined'],
        ),
      ).toBeVisible()
      expect(
        screen.getByText(decision === 'accept' ? 'Отменён' : 'Оплачен'),
      ).toBeVisible()
    },
  )

  it('после конфликта с отправкой показывает актуальный закрытый запрос', async () => {
    let current = initial
    http.defaults.adapter = async (config) => {
      if (config.method === 'get') return response(config, current)
      current = {
        ...initial,
        status: 'shipped',
        allowed_transitions: [],
        cancellation_requests: [
          {
            ...initial.cancellation_requests![0],
            state: 'closed_unavailable',
            public_response: 'Заказ отправлен',
          },
        ],
      }
      throw new AxiosError('conflict', 'ERR', config, undefined, {
        ...response(config, { code: 'order_status_conflict' }),
        status: 409,
      })
    }
    setup()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: copy.acceptCancellation }),
    )
    await user.type(screen.getByLabelText(copy.publicResponse), 'Ответ')
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    expect(await screen.findByText(copy.transitionConflict)).toBeVisible()
    expect(await screen.findByText('Отправлен')).toBeVisible()
    expect(screen.getByText(CANCELLATION_COPY.closed_unavailable)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: copy.acceptCancellation }),
    ).not.toBeInTheDocument()
  })

  it('позднее решение прежнего сотрудника не переносит его приватный комментарий в новую сессию', async () => {
    let release: (() => void) | undefined
    http.defaults.adapter = async (config) => {
      if (config.method === 'get') return response(config, initial)
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return response(config, {
        order: {
          ...initial,
          cancellation_requests: [
            {
              ...initial.cancellation_requests![0],
              state: 'declined',
              private_comment: 'ПРИВАТНЫЙ СТАРЫЙ КОММЕНТАРИЙ',
            },
          ],
        },
        replayed: false,
      })
    }
    const { queryClient } = setup()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: copy.declineCancellation }),
    )
    await user.type(screen.getByLabelText(copy.publicResponse), 'Ответ старой сессии')
    await user.type(
      screen.getByLabelText(copy.privateComment),
      'ПРИВАТНЫЙ СТАРЫЙ КОММЕНТАРИЙ',
    )
    await user.click(screen.getByRole('button', { name: copy.confirm }))
    await waitFor(() => expect(release).toBeDefined())
    act(() => staff('synthetic-staff-b'))
    await screen.findByRole('button', { name: copy.declineCancellation })
    await act(async () => {
      release?.()
      await Promise.resolve()
    })
    expect(screen.queryByText(copy.decisionSuccess)).not.toBeInTheDocument()
    expect(screen.queryByText('ПРИВАТНЫЙ СТАРЫЙ КОММЕНТАРИЙ')).not.toBeInTheDocument()
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data),
      ),
    ).not.toContain('ПРИВАТНЫЙ')
  })
})

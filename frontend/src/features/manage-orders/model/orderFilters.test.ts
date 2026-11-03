import { describe, expect, it } from 'vitest'

import {
  formatManageMoney,
  formatManageOrderDate,
  paymentLabel,
} from '../lib/orderDisplay'
import { MANAGE_ORDERS_COPY } from '@shared/lib/copy'
import { orderFilterParams, readOrderFilters } from './orderFilters'

describe('Фильтры заказов и календарь UTC', () => {
  it.each(['2026-02-30', '0000-01-01', '2026-1-01', '2026-13-01'])(
    'отклоняет несуществующую дату %s',
    (value) => {
      expect(readOrderFilters(new URLSearchParams({ date_from: value })).error).toBe(
        MANAGE_ORDERS_COPY.invalidFilters,
      )
    },
  )
  it.each(['0001-01-01', '9999-12-31', '2024-02-29'])(
    'принимает календарную дату %s',
    (value) => {
      expect(
        readOrderFilters(new URLSearchParams({ date_from: value, date_to: value }))
          .error,
      ).toBe('')
    },
  )
  it('проверяет порядок дат, статус, длину поиска и границы страницы', () => {
    expect(
      readOrderFilters(new URLSearchParams('date_from=2026-02-02&date_to=2026-02-01'))
        .error,
    ).toBeTruthy()
    expect(readOrderFilters(new URLSearchParams('status=refunded')).error).toBe(
      MANAGE_ORDERS_COPY.invalidStatus,
    )
    expect(
      readOrderFilters(new URLSearchParams({ search: 'a'.repeat(256) })).error,
    ).toBe(MANAGE_ORDERS_COPY.invalidSearch)
    for (const page of ['0', '-1', '1.5', 'Infinity', 'NaN', '9007199254740992']) {
      expect(readOrderFilters(new URLSearchParams({ page })).filters.page).toBe(1)
    }
  })
  it('круговой URL сохраняет все фильтры и страницу, без пустых и произвольных параметров', () => {
    const initial = new URLSearchParams(
      'search=a%2Bb%40example.invalid&status=paid&date_from=2026-01-01&date_to=2026-02-02&page=2&returnTo=https://example.invalid',
    )
    const { filters, error } = readOrderFilters(initial)
    expect(error).toBe('')
    const next = orderFilterParams(filters)
    expect(next.get('search')).toBe('a+b@example.invalid')
    expect(next.get('page')).toBe('2')
    expect(next.has('returnTo')).toBe(false)
    expect(readOrderFilters(next).filters).toEqual(filters)
  })
  it('форматирует дату в UTC и сохраняет копейки', () => {
    expect(formatManageOrderDate('2026-01-01T23:30:00-03:00')).toContain(
      '2 января 2026',
    )
    expect(formatManageOrderDate('2026-01-01T23:30:00-03:00')).toContain('02:30 UTC')
    expect(formatManageMoney('375.50')).toContain('375,50')
    expect(formatManageMoney('1234567890.99').replace(/[\s\u00a0]/g, '')).toBe(
      '1234567890,99₽',
    )
    expect(paymentLabel(null)).toBe(MANAGE_ORDERS_COPY.noPayment)
    expect(paymentLabel('private-status')).toBe(MANAGE_ORDERS_COPY.paymentUnknown)
  })
})

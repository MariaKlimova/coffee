import { useEffect } from 'react'
import { isAxiosError } from 'axios'
import { useSearchParams } from 'react-router-dom'

import { getOrderStatusLabel } from '@entities/order'
import { isNotFoundError } from '@shared/api'
import { MANAGE_COPY, MANAGE_ORDERS_COPY } from '@shared/lib/copy'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'
import { Select } from '@shared/ui/Select'
import { EmptyState } from '@shared/ui/EmptyState'

import { MANAGE_ORDERS_PAGE_SIZE } from '../../api/manageOrdersApi'
import {
  MANAGE_ORDER_STATUSES,
  orderFilterParams,
  readOrderFilters,
} from '../../model/orderFilters'
import { useManageOrders } from '../../model/useManageOrders'
import { ManageOrderRow } from '../ManageOrderRow'
import styles from './ManageOrders.module.css'

export function ManageOrders() {
  const [params, setParams] = useSearchParams()
  const { filters, error } = readOrderFilters(params)
  const orders = useManageOrders(filters, !error)
  const resetPage = !error && filters.page > 1 && isNotFoundError(orders.error)
  useEffect(() => {
    if (!resetPage) return
    const next = new URLSearchParams(params)
    next.delete('page')
    setParams(next, { replace: true })
  }, [resetPage, params, setParams])
  const denied = isAxiosError(orders.error) && orders.error.response?.status === 403
  const totalPages = Math.max(
    1,
    Math.ceil((orders.data?.count ?? 0) / MANAGE_ORDERS_PAGE_SIZE),
  )
  const filterSearch = orderFilterParams(filters).toString()
  const detailSearch = filterSearch ? `?${filterSearch}` : ''
  const data = !error && !orders.isError ? orders.data : undefined
  return (
    <section className={styles.ManageOrders}>
      <header>
        <h1>{MANAGE_ORDERS_COPY.title}</h1>
        <p>{MANAGE_ORDERS_COPY.description}</p>
      </header>
      <form
        key={params.toString()}
        className={styles['ManageOrders-Filters']}
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const next = new URLSearchParams()
          for (const key of ['search', 'status', 'date_from', 'date_to']) {
            const value = String(form.get(key) ?? '').trim()
            if (value) next.set(key, value)
          }
          setParams(next)
        }}
      >
        <Input
          label={MANAGE_ORDERS_COPY.search}
          placeholder={MANAGE_ORDERS_COPY.searchHint}
          name="search"
          defaultValue={filters.search}
          maxLength={255}
        />
        <Select
          label={MANAGE_ORDERS_COPY.status}
          name="status"
          defaultValue={filters.status}
          options={[
            { value: '', label: MANAGE_ORDERS_COPY.allStatuses },
            ...MANAGE_ORDER_STATUSES.map((value) => ({
              value,
              label: getOrderStatusLabel(value),
            })),
          ]}
        />
        <Input
          label={MANAGE_ORDERS_COPY.dateFrom}
          type="date"
          name="date_from"
          defaultValue={filters.date_from}
          min="0001-01-01"
          max="9999-12-31"
        />
        <Input
          label={MANAGE_ORDERS_COPY.dateTo}
          type="date"
          name="date_to"
          defaultValue={filters.date_to}
          min="0001-01-01"
          max="9999-12-31"
        />
        <div className={styles['ManageOrders-Actions']}>
          <Button type="submit" variant="secondary">
            {MANAGE_ORDERS_COPY.apply}
          </Button>
          <Button variant="ghost" onClick={() => setParams({})}>
            {MANAGE_ORDERS_COPY.reset}
          </Button>
        </div>
      </form>
      <p className={styles['ManageOrders-Hint']}>{MANAGE_ORDERS_COPY.dateHint}</p>
      {error && <p role="alert">{error}</p>}
      {!error && (orders.isPending || resetPage) && (
        <p role="status">{MANAGE_ORDERS_COPY.loading}</p>
      )}
      {!error && orders.isError && !resetPage && (
        <EmptyState
          title={denied ? MANAGE_COPY.deniedTitle : MANAGE_ORDERS_COPY.error}
          description={
            denied ? MANAGE_COPY.deniedDescription : MANAGE_ORDERS_COPY.errorDescription
          }
          action={
            !denied && (
              <Button
                onClick={() => {
                  void orders.refetch()
                }}
              >
                {MANAGE_ORDERS_COPY.retry}
              </Button>
            )
          }
        />
      )}
      {data && <p role="status">{MANAGE_ORDERS_COPY.count(data.count)}</p>}
      {data?.results.length === 0 && (
        <EmptyState
          title={MANAGE_ORDERS_COPY.empty}
          description={MANAGE_ORDERS_COPY.emptyDescription}
          action={
            <Button variant="secondary" onClick={() => setParams({})}>
              {MANAGE_ORDERS_COPY.reset}
            </Button>
          }
        />
      )}
      {data && data.results.length > 0 && (
        <ul className={styles['ManageOrders-List']} aria-busy={orders.isFetching}>
          {data.results.map((order) => (
            <ManageOrderRow key={order.id} order={order} search={detailSearch} />
          ))}
        </ul>
      )}
      {data && (totalPages > 1 || filters.page > 1) && (
        <nav
          className={styles['ManageOrders-Pagination']}
          aria-label={MANAGE_ORDERS_COPY.pagination}
        >
          <Button
            variant="secondary"
            disabled={filters.page <= 1 || orders.isFetching}
            onClick={() =>
              setParams(orderFilterParams({ ...filters, page: filters.page - 1 }))
            }
          >
            {MANAGE_ORDERS_COPY.previous}
          </Button>
          <span>{MANAGE_ORDERS_COPY.page(filters.page, totalPages)}</span>
          <Button
            variant="secondary"
            disabled={!data.next || orders.isFetching}
            onClick={() =>
              setParams(orderFilterParams({ ...filters, page: filters.page + 1 }))
            }
          >
            {MANAGE_ORDERS_COPY.next}
          </Button>
        </nav>
      )}
    </section>
  )
}

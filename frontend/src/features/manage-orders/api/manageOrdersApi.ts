import type { Paginated } from '@entities/product'
import { guardRequest, http } from '@shared/api'

import type {
  ManageOrder,
  ManageOrderFilters,
  ManageOrderListItem,
} from './manageOrdersApi.typings'

export const MANAGE_ORDERS_PAGE_SIZE = 20

/** Отдельный staff API; покупательские endpoints и платежи не вызываются. */
export async function fetchManageOrders(
  filters: ManageOrderFilters,
  signal: AbortSignal,
  assertStaff: () => void,
) {
  const params = Object.fromEntries(
    Object.entries({ ...filters, page_size: MANAGE_ORDERS_PAGE_SIZE }).filter(
      ([, value]) => value !== '',
    ),
  )
  const { data } = await http.get<Paginated<ManageOrderListItem>>(
    '/api/manage/orders/',
    { ...guardRequest(assertStaff), params, signal },
  )
  assertStaff()
  return data
}

export async function fetchManageOrder(
  id: string,
  signal: AbortSignal,
  assertStaff: () => void,
) {
  const { data } = await http.get<ManageOrder>(
    `/api/manage/orders/${encodeURIComponent(id)}/`,
    { ...guardRequest(assertStaff), signal },
  )
  assertStaff()
  return data
}

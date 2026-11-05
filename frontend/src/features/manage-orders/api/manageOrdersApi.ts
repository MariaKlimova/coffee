import type { Paginated } from '@entities/product'
import { guardRequest, http } from '@shared/api'

import type {
  ManageOrder,
  ManageOrderFilters,
  ManageOrderListItem,
  OrderTransitionResponse,
  OrderTransitionWrite,
  CancellationDecisionWrite,
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

export async function decideCancellationRequest(
  id: string,
  requestId: string,
  values: CancellationDecisionWrite,
  assertStaff: () => void,
) {
  assertStaff()
  const { data } = await http.post<OrderTransitionResponse>(
    `/api/manage/orders/${encodeURIComponent(id)}/cancellation-requests/${encodeURIComponent(requestId)}/decision/`,
    values,
    guardRequest(assertStaff),
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

export async function transitionManageOrder(
  id: string,
  values: OrderTransitionWrite,
  assertStaff: () => void,
) {
  assertStaff()
  const { data } = await http.post<OrderTransitionResponse>(
    `/api/manage/orders/${encodeURIComponent(id)}/transitions/`,
    values,
    guardRequest(assertStaff),
  )
  assertStaff()
  return data
}

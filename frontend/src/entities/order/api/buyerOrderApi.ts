import { guardRequest, http } from '@shared/api'
import { privateOrderFailure } from './privateOrderFailure'

import type {
  BuyerAction,
  BuyerActionResponse,
  BuyerActions,
  BuyerActionWrite,
  GuestCheckoutRecovery,
} from './orderApi.typings'

function protectedConfig(assertActor: () => void, token?: string) {
  assertActor()
  return {
    ...guardRequest(assertActor),
    headers: token ? { 'X-Order-Action-Token': token } : undefined,
  }
}

export async function fetchBuyerActions(
  id: string,
  assertActor: () => void,
  token?: string,
  signal?: AbortSignal,
): Promise<BuyerActions> {
  const { data } = await http
    .get<BuyerActions>(`/api/orders/${encodeURIComponent(id)}/buyer-actions/`, {
      ...protectedConfig(assertActor, token),
      signal,
    })
    .catch((failure: unknown) => {
      throw privateOrderFailure(failure)
    })
  assertActor()
  return data
}

export async function submitBuyerAction(
  id: string,
  action: BuyerAction,
  values: BuyerActionWrite,
  assertActor: () => void,
  token?: string,
): Promise<BuyerActionResponse> {
  const endpoint = action === 'cancel' ? 'cancel' : 'cancellation-requests'
  const { data } = await http
    .post<BuyerActionResponse>(
      `/api/orders/${encodeURIComponent(id)}/${endpoint}/`,
      values,
      protectedConfig(assertActor, token),
    )
    .catch((failure: unknown) => {
      throw privateOrderFailure(failure)
    })
  assertActor()
  return data
}

/** Восстановление не использует текущую корзину и не возвращает секрет через QueryClient. */
export async function recoverGuestCheckout(
  checkoutRequestId: string,
  originalCartToken: string,
  assertActor: () => void,
): Promise<GuestCheckoutRecovery> {
  assertActor()
  const { data } = await http
    .post<GuestCheckoutRecovery>(
      '/api/orders/checkout-recovery/',
      { checkout_request_id: checkoutRequestId },
      {
        ...guardRequest(assertActor),
        headers: { 'X-Cart-Token': originalCartToken },
      },
    )
    .catch((failure: unknown) => {
      throw privateOrderFailure(failure)
    })
  assertActor()
  return data
}

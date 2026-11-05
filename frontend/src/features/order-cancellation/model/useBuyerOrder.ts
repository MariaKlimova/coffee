import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CanceledError, isAxiosError } from 'axios'

import {
  fetchBuyerActions,
  guestOrderProofVersion,
  readGuestOrderProof,
  subscribeGuestOrderProof,
} from '@entities/order'
import { isSameCustomerSession, selectCanShop, useAuthStore } from '@entities/user'

/** Приватная карточка привязана к сессии и версии гостевого доступа. */
export function useBuyerOrder(id: string) {
  const client = useQueryClient()
  const status = useAuthStore((state) => state.status)
  const generation = useAuthStore((state) => state.sessionGeneration)
  const userId = useAuthStore((state) => state.user?.id)
  const canShop = useAuthStore(selectCanShop)
  const proofVersion = useSyncExternalStore(subscribeGuestOrderProof, () =>
    guestOrderProofVersion(id),
  )
  const scope = useMemo(
    () =>
      `${generation}:${status}:${userId ?? 'guest'}:${proofVersion}:${crypto.randomUUID()}`,
    [generation, status, userId, proofVersion],
  )
  const queryKey = ['buyer-orders', generation, userId ?? 'guest', id, scope] as const
  const actor = useAuthStore.getState()
  const proof = status === 'guest' ? readGuestOrderProof(id) : null
  const ready =
    canShop && (status === 'authenticated' || (status === 'guest' && Boolean(proof)))
  const assertActor = () => {
    if (
      !ready ||
      !isSameCustomerSession(actor, useAuthStore.getState()) ||
      (status === 'guest' && readGuestOrderProof(id)?.version !== proof?.version)
    ) {
      throw new CanceledError('Сессия заказа изменилась')
    }
  }
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchBuyerActions(id, assertActor, proof?.token, signal),
    enabled: ready && Boolean(id),
    retry: false,
    gcTime: 0,
  })
  useEffect(() => {
    const key = ['buyer-orders', generation, userId ?? 'guest', id, scope]
    return () => {
      void client.cancelQueries({ queryKey: key })
      client.removeQueries({ queryKey: key })
    }
  }, [client, generation, userId, id, scope])
  return {
    ...query,
    data:
      ready &&
      !(
        isAxiosError(query.error) &&
        [401, 403, 404].includes(query.error.response?.status ?? 0)
      )
        ? query.data
        : undefined,
    ready,
    assertActor,
    token: proof?.token,
    actorKey: status === 'authenticated' ? `account:${userId}` : 'guest',
    scope,
    queryKey,
  }
}

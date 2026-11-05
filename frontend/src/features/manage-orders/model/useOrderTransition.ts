import { useMutation, useQueryClient } from '@tanstack/react-query'

import { bindStaff, useAuthStore } from '@entities/user'

import { transitionManageOrder } from '../api/manageOrdersApi'
import type { OrderTransitionWrite } from '../api/manageOrdersApi.typings'

/** Записывает только подтверждённое сервером состояние в кэш исходной сессии. */
export function useOrderTransition(id: string) {
  const client = useQueryClient()
  const generation = useAuthStore((state) => state.sessionGeneration)
  const userId = useAuthStore((state) => state.user?.id)
  const prefix = ['manage-orders', generation, userId] as const
  const assertActor = bindStaff()
  const mutation = useMutation({
    mutationFn: async ({
      values,
      assertActor,
    }: {
      values: OrderTransitionWrite
      assertActor: () => void
    }) => {
      const result = await transitionManageOrder(id, values, assertActor)
      const keys: (readonly unknown[])[] = [prefix]
      if (values.to_status === 'cancelled') {
        keys.push(['manage-catalog', generation, userId], ['products'])
      }
      await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey })))
      assertActor()
      const detailKey = [...prefix, 'detail', id]
      const detail = client.getQueryCache().find({ queryKey: detailKey, exact: true })
      // Уход со страницы уже очистил приватный заказ: не создаём его заново.
      if (detail?.getObserversCount()) client.setQueryData(detailKey, result.order)
      // Исторический состав заказа не сохраняется в состоянии mutation.
      await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
      assertActor()
      return { replayed: result.replayed }
    },
    retry: false,
    gcTime: 0,
  })
  return {
    submit: (values: OrderTransitionWrite) => {
      // Сохранённый callback старого рендера не становится действием новой сессии.
      assertActor()
      return mutation.mutateAsync({ values, assertActor })
    },
  }
}

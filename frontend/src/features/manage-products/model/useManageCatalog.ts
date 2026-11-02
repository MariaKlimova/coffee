import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { selectCanManage, useAuthStore } from '@entities/user'

import {
  changeManageProduct,
  disableDemo,
  fetchCatalogState,
  fetchManageProducts,
  type ManageFilters,
  type ProductChange,
} from '../api/manageCatalogApi'

/** Захватывает инициатора до любого ожидания и проверяет его также на транспортной границе. */
function bindStaff() {
  const actor = useAuthStore.getState()
  return () => {
    const current = useAuthStore.getState()
    if (
      !selectCanManage(actor) ||
      !selectCanManage(current) ||
      actor.sessionGeneration !== current.sessionGeneration ||
      actor.user?.id !== current.user?.id
    ) {
      throw new Error('Сессия управления завершена')
    }
  }
}

/** Отдельный кэш каждой сессии без показа данных предыдущего владельца. */
export function useManageCatalog(filters: ManageFilters) {
  const client = useQueryClient()
  const generation = useAuthStore((state) => state.sessionGeneration)
  const userId = useAuthStore((state) => state.user?.id)
  const enabled = useAuthStore(selectCanManage)
  const prefix = ['manage-catalog', generation, userId] as const
  const assertActor = bindStaff()
  useEffect(() => {
    const key = ['manage-catalog', generation, userId]
    return () => {
      void client.cancelQueries({ queryKey: key })
      client.removeQueries({ queryKey: key })
    }
  }, [client, generation, userId])
  const products = useQuery({
    queryKey: [...prefix, 'products', filters],
    queryFn: ({ signal }) => fetchManageProducts(filters, signal, assertActor),
    enabled,
    gcTime: 0,
  })
  const catalog = useQuery({
    queryKey: [...prefix, 'state'],
    queryFn: ({ signal }) => fetchCatalogState(signal, assertActor),
    enabled,
    gcTime: 0,
  })
  async function invalidate() {
    await Promise.all([
      client.invalidateQueries({ queryKey: prefix }),
      ...['products', 'cart', 'favorites'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    ])
  }
  const change = useMutation({
    mutationFn: ({ values, assert }: { values: ProductChange; assert: () => void }) => {
      assert()
      return changeManageProduct(values, assert)
    },
    onSuccess: async (_, { assert }) => {
      assert()
      await invalidate()
    },
    gcTime: 0,
  })
  const cutover = useMutation({
    mutationFn: ({ assert }: { assert: () => void }) => {
      assert()
      return disableDemo(assert)
    },
    onSuccess: async (_, { assert }) => {
      assert()
      await invalidate()
    },
    gcTime: 0,
  })
  return {
    products,
    catalog,
    changeProduct: (values: ProductChange) =>
      change.mutateAsync({ values, assert: bindStaff() }),
    disableDemo: () => cutover.mutateAsync({ assert: bindStaff() }),
  }
}

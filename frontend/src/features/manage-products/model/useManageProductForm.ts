import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { selectCanManage, useAuthStore } from '@entities/user'
import {
  fetchManageProduct,
  saveManageProduct,
  type ProductFormWrite,
} from '../api/manageCatalogApi'
import { bindStaff } from './bindStaff'

export function useManageProductForm(id?: string) {
  const client = useQueryClient()
  const generation = useAuthStore((state) => state.sessionGeneration)
  const userId = useAuthStore((state) => state.user?.id)
  const enabled = useAuthStore(selectCanManage)
  const prefix = ['manage-catalog', generation, userId] as const
  const key = [...prefix, 'detail', id] as const
  const assert = bindStaff()
  const product = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchManageProduct(id!, signal, assert),
    enabled: enabled && !!id,
    gcTime: 0,
  })
  useEffect(() => {
    const previousKey = ['manage-catalog', generation, userId, 'detail', id]
    return () => {
      void client.cancelQueries({ queryKey: previousKey })
      client.removeQueries({ queryKey: previousKey })
    }
  }, [client, generation, userId, id])
  const save = useMutation({
    mutationFn: ({
      values,
      assertActor,
    }: {
      values: ProductFormWrite
      assertActor: () => void
    }) => {
      assertActor()
      return saveManageProduct(values, id, assertActor)
    },
    onSuccess: async (_, { assertActor }) => {
      assertActor()
      await Promise.all([
        client.invalidateQueries({ queryKey: prefix }),
        ...['products', 'cart', 'favorites'].map((name) =>
          client.invalidateQueries({ queryKey: [name] }),
        ),
      ])
      assertActor()
    },
    gcTime: 0,
  })
  return {
    product,
    enabled,
    formKey: `${generation}:${userId}:${id ?? 'new'}`,
    save: (values: ProductFormWrite) =>
      save.mutateAsync({ values, assertActor: bindStaff() }),
  }
}

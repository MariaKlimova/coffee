import { useMutation, useQueryClient } from '@tanstack/react-query'
import { bindStaff, useAuthStore } from '@entities/user'
import { changeManageImage, type ImageChange } from '../api/manageImagesApi'
import { invalidateManageProducts } from './invalidateManageProducts'

export function useManageImages(productId: string) {
  const client = useQueryClient()
  const generation = useAuthStore((state) => state.sessionGeneration)
  const userId = useAuthStore((state) => state.user?.id)
  const prefix = ['manage-catalog', generation, userId] as const
  const mutation = useMutation({
    mutationFn: ({
      change,
      assertActor,
    }: {
      change: ImageChange
      assertActor: () => void
    }) => changeManageImage(productId, change, assertActor),
    onSuccess: (_, { assertActor }) =>
      invalidateManageProducts(client, prefix, assertActor),
    gcTime: 0,
  })
  return {
    pending: mutation.isPending,
    change: (change: ImageChange) =>
      mutation.mutateAsync({ change, assertActor: bindStaff() }),
  }
}

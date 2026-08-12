import { useFavoriteMutation } from '@entities/favorite'
import { useAuthStore } from '@entities/user'
import { useToast } from '@shared/ui'

import { FAVORITE_COPY } from '../toggleFavorite.const'

/**
 * Toggles a product in favorites with guest toast and error feedback.
 */
export function useToggleFavorite() {
  const status = useAuthStore((state) => state.status)
  const { showToast } = useToast()
  const mutation = useFavoriteMutation()

  function toggleFavorite(productId: string, isFavorite: boolean): void {
    if (status !== 'authenticated') {
      showToast({
        message: FAVORITE_COPY.guestHint,
        variant: 'info',
      })
      return
    }

    if (mutation.isPending) {
      return
    }

    mutation.mutate(
      { productId, isFavorite },
      {
        onError: () => {
          showToast({
            message: FAVORITE_COPY.error,
            variant: 'error',
          })
        },
      },
    )
  }

  return {
    toggleFavorite,
    isPending: mutation.isPending,
  }
}

import { useFavoriteMutation } from '@entities/favorite'
import { isSameCustomerSession, selectCanShop, useAuthStore } from '@entities/user'
import { FAVORITE_COPY } from '@shared/lib/copy'
import { useToast } from '@shared/ui'

/**
 * Toggles a product in favorites with guest toast and error feedback.
 */
export function useToggleFavorite() {
  const status = useAuthStore((state) => state.status)
  const { showToast } = useToast()
  const mutation = useFavoriteMutation()

  function toggleFavorite(productId: string, isFavorite: boolean): void {
    if (!selectCanShop(useAuthStore.getState())) return
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

    const session = useAuthStore.getState()
    mutation.mutate(
      { productId, isFavorite },
      {
        onError: () => {
          if (!isSameCustomerSession(session, useAuthStore.getState())) return
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

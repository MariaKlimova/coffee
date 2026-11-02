import { useCartMutations } from '@entities/cart'
import { isSameCustomerSession, selectCanShop, useAuthStore } from '@entities/user'
import { CART_COPY } from '@shared/lib/copy'
import { useToast } from '@shared/ui'

/**
 * Добавляет товар в корзину с toast об успехе / ошибке.
 * Гостю можно (корзина определяется через X-Cart-Token).
 */
export function useAddToCart() {
  const { showToast } = useToast()
  const { addItem } = useCartMutations()

  function addToCart(productId: string, quantity = 1): void {
    if (!selectCanShop(useAuthStore.getState()) || quantity < 1) {
      return
    }

    if (addItem.isPending) {
      return
    }

    const session = useAuthStore.getState()
    addItem.mutate(
      { productId, quantity },
      {
        onSuccess: () => {
          if (!isSameCustomerSession(session, useAuthStore.getState())) return
          showToast({
            message: CART_COPY.added,
            variant: 'success',
          })
        },
        onError: () => {
          if (!isSameCustomerSession(session, useAuthStore.getState())) return
          showToast({
            message: CART_COPY.error,
            variant: 'error',
          })
        },
      },
    )
  }

  return {
    addToCart,
    isPending: addItem.isPending,
  }
}

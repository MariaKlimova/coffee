import { useCart, useCartMutations } from '@entities/cart'

import { useAddToCart } from './useAddToCart'

/**
 * Действия с количеством товара в корзине по product UUID
 * (добавить, изменить или убрать при quantity меньше 1).
 */
export function useCartLineActions() {
  const cartQuery = useCart()
  const { addToCart, isPending: isAddPending } = useAddToCart()
  const { updateItem, removeItem } = useCartMutations()

  function getQuantity(productId: string): number {
    const line = cartQuery.data?.items?.find((item) => item.product.id === productId)
    return line?.quantity ?? 0
  }

  function setQuantity(productId: string, quantity: number): void {
    const line = cartQuery.data?.items?.find((item) => item.product.id === productId)

    if (quantity < 1) {
      if (line) {
        removeItem.mutate({ itemId: line.id })
      }
      return
    }

    if (!line) {
      addToCart(productId, quantity)
      return
    }

    updateItem.mutate({ itemId: line.id, quantity })
  }

  return {
    getQuantity,
    setQuantity,
    addToCart,
    isPending: isAddPending || updateItem.isPending || removeItem.isPending,
  }
}

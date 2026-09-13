import { useMutation, useQueryClient } from '@tanstack/react-query'

import { addItem, removeItem, updateItem } from '../api/cartApi'
import {
  applyCartAddToCaches,
  applyCartItemUpsertToCaches,
  applyCartRemoveToCaches,
  applyCartUpdateToCaches,
} from '../lib/applyCartToCaches'
import { cartKeys } from './cartQueryOptions'

/**
 * Аргументы добавления товара в корзину.
 */
export interface CartAddVariables {
  /** UUID товара. */
  productId: string
  /** Количество (≥ 1). */
  quantity: number
}

/**
 * Аргументы обновления количества позиции.
 */
export interface CartUpdateVariables {
  /** UUID позиции корзины. */
  itemId: string
  /** Новое количество (≥ 1). */
  quantity: number
}

/**
 * Аргументы удаления позиции.
 */
export interface CartRemoveVariables {
  /** UUID позиции корзины. */
  itemId: string
}

/**
 * Оптимистичные мутации корзины со снимком кэша и откатом при ошибке.
 */
export function useCartMutations() {
  const queryClient = useQueryClient()

  const addMutation = useMutation({
    mutationFn: ({ productId, quantity }: CartAddVariables) =>
      addItem(productId, quantity),
    onMutate: async ({ productId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.all })
      const previousCart = queryClient.getQueryData(cartKeys.detail())
      applyCartAddToCaches(queryClient, productId, quantity)
      return { previousCart }
    },
    onSuccess: (cartItem) => {
      applyCartItemUpsertToCaches(queryClient, cartItem)
    },
    onError: (_error, _variables, context) => {
      if (!context) {
        return
      }
      queryClient.setQueryData(cartKeys.detail(), context.previousCart)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: CartUpdateVariables) =>
      updateItem(itemId, quantity),
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.all })
      const previousCart = queryClient.getQueryData(cartKeys.detail())
      applyCartUpdateToCaches(queryClient, itemId, quantity)
      return { previousCart }
    },
    onError: (_error, _variables, context) => {
      if (!context) {
        return
      }
      queryClient.setQueryData(cartKeys.detail(), context.previousCart)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })

  const removeMutation = useMutation({
    mutationFn: ({ itemId }: CartRemoveVariables) => removeItem(itemId),
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.all })
      const previousCart = queryClient.getQueryData(cartKeys.detail())
      applyCartRemoveToCaches(queryClient, itemId)
      return { previousCart }
    },
    onError: (_error, _variables, context) => {
      if (!context) {
        return
      }
      queryClient.setQueryData(cartKeys.detail(), context.previousCart)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })

  return {
    addItem: addMutation,
    updateItem: updateMutation,
    removeItem: removeMutation,
  }
}

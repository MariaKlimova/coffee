import { useMutation, useQueryClient } from '@tanstack/react-query'

import { isSameCustomerSession, selectCanShop, useAuthStore } from '@entities/user'

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
    mutationFn: ({ productId, quantity }: CartAddVariables) => {
      if (!selectCanShop(useAuthStore.getState()))
        throw new Error('Покупательское действие недоступно')
      return addItem(productId, quantity)
    },
    onMutate: async ({ productId, quantity }) => {
      const session = useAuthStore.getState()
      if (!selectCanShop(session)) return undefined
      await queryClient.cancelQueries({ queryKey: cartKeys.all })
      if (!isSameCustomerSession(session, useAuthStore.getState())) return undefined
      const previousCart = queryClient.getQueryData(cartKeys.detail())
      applyCartAddToCaches(queryClient, productId, quantity)
      return { previousCart, session }
    },
    onSuccess: (cartItem, _variables, context) => {
      if (!context || !isSameCustomerSession(context.session, useAuthStore.getState()))
        return
      applyCartItemUpsertToCaches(queryClient, cartItem)
    },
    onError: (_error, _variables, context) => {
      if (
        !context ||
        !isSameCustomerSession(context.session, useAuthStore.getState())
      ) {
        return
      }
      queryClient.setQueryData(cartKeys.detail(), context.previousCart)
    },
    onSettled: (_data, _error, _variables, context) => {
      if (!context || !isSameCustomerSession(context.session, useAuthStore.getState()))
        return
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: CartUpdateVariables) => {
      if (!selectCanShop(useAuthStore.getState()))
        throw new Error('Покупательское действие недоступно')
      return updateItem(itemId, quantity)
    },
    onMutate: async ({ itemId, quantity }) => {
      const session = useAuthStore.getState()
      if (!selectCanShop(session)) return undefined
      await queryClient.cancelQueries({ queryKey: cartKeys.all })
      if (!isSameCustomerSession(session, useAuthStore.getState())) return undefined
      const previousCart = queryClient.getQueryData(cartKeys.detail())
      applyCartUpdateToCaches(queryClient, itemId, quantity)
      return { previousCart, session }
    },
    onError: (_error, _variables, context) => {
      if (
        !context ||
        !isSameCustomerSession(context.session, useAuthStore.getState())
      ) {
        return
      }
      queryClient.setQueryData(cartKeys.detail(), context.previousCart)
    },
    onSettled: (_data, _error, _variables, context) => {
      if (!context || !isSameCustomerSession(context.session, useAuthStore.getState()))
        return
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })

  const removeMutation = useMutation({
    mutationFn: ({ itemId }: CartRemoveVariables) => {
      if (!selectCanShop(useAuthStore.getState()))
        throw new Error('Покупательское действие недоступно')
      return removeItem(itemId)
    },
    onMutate: async ({ itemId }) => {
      const session = useAuthStore.getState()
      if (!selectCanShop(session)) return undefined
      await queryClient.cancelQueries({ queryKey: cartKeys.all })
      if (!isSameCustomerSession(session, useAuthStore.getState())) return undefined
      const previousCart = queryClient.getQueryData(cartKeys.detail())
      applyCartRemoveToCaches(queryClient, itemId)
      return { previousCart, session }
    },
    onError: (_error, _variables, context) => {
      if (
        !context ||
        !isSameCustomerSession(context.session, useAuthStore.getState())
      ) {
        return
      }
      queryClient.setQueryData(cartKeys.detail(), context.previousCart)
    },
    onSettled: (_data, _error, _variables, context) => {
      if (!context || !isSameCustomerSession(context.session, useAuthStore.getState()))
        return
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })

  return {
    addItem: addMutation,
    updateItem: updateMutation,
    removeItem: removeMutation,
  }
}

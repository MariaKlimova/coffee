import { useMutation, useQueryClient } from '@tanstack/react-query'

import { productKeys } from '@entities/product'
import {
  isSameCustomerSession,
  selectCanUseFavorites,
  useAuthStore,
} from '@entities/user'

import { addFavorite, removeFavorite } from '../api/favoriteApi'
import { applyFavoriteToCaches } from '../lib/applyFavoriteToCaches'
import { favoriteKeys } from './favoriteQueryOptions'

/**
 * Inputs for toggling a product in favorites.
 */
export interface FavoriteMutationVariables {
  /** Product UUID. */
  productId: string
  /** Current favorite flag before the toggle. */
  isFavorite: boolean
}

/**
 * Optimistic add/remove favorite mutation with cache snapshot rollback.
 */
export function useFavoriteMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ productId, isFavorite }: FavoriteMutationVariables) => {
      if (!selectCanUseFavorites(useAuthStore.getState()))
        throw new Error('Покупательское действие недоступно')
      if (isFavorite) {
        await removeFavorite(productId)
        return
      }
      await addFavorite(productId)
    },
    onMutate: async ({ productId, isFavorite }) => {
      const session = useAuthStore.getState()
      if (!selectCanUseFavorites(session)) return undefined
      await queryClient.cancelQueries({ queryKey: productKeys.all })
      await queryClient.cancelQueries({ queryKey: favoriteKeys.all })

      if (!isSameCustomerSession(session, useAuthStore.getState())) return undefined
      const previousProducts = queryClient.getQueriesData({ queryKey: productKeys.all })
      const previousFavorites = queryClient.getQueriesData({
        queryKey: favoriteKeys.all,
      })

      applyFavoriteToCaches(queryClient, productId, !isFavorite)

      return { previousProducts, previousFavorites, session }
    },
    onError: (_error, _variables, context) => {
      if (
        !context ||
        !isSameCustomerSession(context.session, useAuthStore.getState())
      ) {
        return
      }
      for (const [queryKey, data] of context.previousProducts) {
        queryClient.setQueryData(queryKey, data)
      }
      for (const [queryKey, data] of context.previousFavorites) {
        queryClient.setQueryData(queryKey, data)
      }
    },
    onSettled: (_data, _error, _variables, context) => {
      if (!context || !isSameCustomerSession(context.session, useAuthStore.getState()))
        return
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: favoriteKeys.all })
    },
  })
}

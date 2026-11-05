import { type ReactNode, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { cartKeys, mergeCart, useCartStore } from '@entities/cart'
import { favoriteKeys } from '@entities/favorite'
import { productKeys } from '@entities/product'
import { orderKeys } from '@entities/order'
import { clearBuyerIntents } from '@features/order-cancellation'
import { selectAccountMode, selectCanShop, useAuthStore } from '@entities/user'

interface AuthProviderProps {
  /** Дерево приложения внутри провайдера. */
  children: ReactNode
}

/**
 * Восстанавливает сессию при первом маунте, если есть refresh token.
 * При смене auth: обновляет кэши товаров под `is_favorite`, сливает гостевую
 * корзину после логина, сбрасывает кэши избранного/корзины при выходе.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const restoreSession = useAuthStore((state) => state.restoreSession)
  const status = useAuthStore((state) => state.status)
  const mode = useAuthStore(selectAccountMode)
  const userId = useAuthStore((state) => state.user?.id)
  const generation = useAuthStore((state) => state.sessionGeneration)
  const previousSessionRef = useRef({ status, mode, userId, generation })

  useEffect(() => {
    if (status !== 'idle') {
      return
    }
    void restoreSession()
  }, [restoreSession, status])

  useEffect(() => {
    const previous = previousSessionRef.current
    previousSessionRef.current = { status, mode, userId, generation }
    const previousStatus = previous.status

    if (
      previousStatus === status &&
      previous.mode === mode &&
      previous.userId === userId &&
      previous.generation === generation
    ) {
      return
    }
    if (status !== 'authenticated' && status !== 'guest') {
      return
    }

    const oldScope = `${previous.generation}:${previous.status}:${previous.userId ?? 'guest'}`
    const oldOrders = {
      queryKey: orderKeys.all,
      predicate: (query: { queryKey: readonly unknown[] }) =>
        query.queryKey.some(
          (part) => typeof part === 'string' && part.startsWith(oldScope),
        ),
    }
    void queryClient.cancelQueries(oldOrders)
    queryClient.removeQueries(oldOrders)
    const oldBuyer = {
      queryKey: ['buyer-orders', previous.generation, previous.userId ?? 'guest'],
    }
    void queryClient.cancelQueries(oldBuyer)
    queryClient.removeQueries(oldBuyer)
    if (previousStatus === 'authenticated' || previousStatus === 'guest')
      clearBuyerIntents()

    void queryClient.cancelQueries({ queryKey: productKeys.all })
    void queryClient.resetQueries({ queryKey: productKeys.all })

    if (status === 'guest' || mode === 'owner') {
      // Убираем данные прежней сессии, сохраняя подписки шапки и страниц.
      // Удаление активного query оставляет его observers без новых результатов.
      void queryClient.cancelQueries({ queryKey: favoriteKeys.all })
      void queryClient.cancelQueries({ queryKey: cartKeys.all })
      void queryClient.resetQueries({ queryKey: favoriteKeys.all })
      void queryClient.resetQueries({ queryKey: cartKeys.all })
      return
    }

    void queryClient.resetQueries({ queryKey: favoriteKeys.all })

    if (previousStatus === 'authenticated') {
      void queryClient.resetQueries({ queryKey: cartKeys.all })
      return
    }

    // Старый гостевой ответ не должен перезаписать корзину после входа/merge.
    void queryClient.cancelQueries({ queryKey: cartKeys.all })
    const cartToken = useCartStore.getState().cartToken
    if (!cartToken) {
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
      return
    }

    const session = useAuthStore.getState()
    const isCurrentSession = () => {
      const current = useAuthStore.getState()
      return (
        current.status === 'authenticated' &&
        selectCanShop(current) &&
        current.refreshToken === session.refreshToken &&
        current.user?.id === session.user?.id
      )
    }

    void (async () => {
      try {
        await mergeCart(cartToken)
        // Поздний merge не должен очищать токен новой гостевой корзины/сессии.
        if (isCurrentSession() && useCartStore.getState().cartToken === cartToken) {
          useCartStore.getState().clearCartToken()
        }
      } catch {
        // Токен оставляем — merge можно повторить при следующей сессии.
      } finally {
        if (isCurrentSession()) {
          void queryClient.invalidateQueries({ queryKey: cartKeys.all })
        }
      }
    })()
  }, [status, mode, userId, generation, queryClient])

  return children
}

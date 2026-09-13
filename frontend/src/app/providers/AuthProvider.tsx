import { type ReactNode, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { cartKeys, mergeCart, useCartStore } from '@entities/cart'
import { favoriteKeys } from '@entities/favorite'
import { productKeys } from '@entities/product'
import { useAuthStore } from '@entities/user'

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
  const previousStatusRef = useRef(status)

  useEffect(() => {
    if (status !== 'idle') {
      return
    }
    void restoreSession()
  }, [restoreSession, status])

  useEffect(() => {
    const previousStatus = previousStatusRef.current
    previousStatusRef.current = status

    if (previousStatus === status) {
      return
    }
    if (status !== 'authenticated' && status !== 'guest') {
      return
    }

    void queryClient.invalidateQueries({ queryKey: productKeys.all })

    if (status === 'guest') {
      // Сбрасываем кэши, чтобы счётчики в шапке не «залипали» после выхода.
      queryClient.removeQueries({ queryKey: favoriteKeys.all })
      queryClient.removeQueries({ queryKey: cartKeys.all })
      return
    }

    void queryClient.invalidateQueries({ queryKey: favoriteKeys.all })

    if (previousStatus === 'authenticated') {
      return
    }

    const cartToken = useCartStore.getState().cartToken
    if (!cartToken) {
      void queryClient.invalidateQueries({ queryKey: cartKeys.all })
      return
    }

    void (async () => {
      try {
        await mergeCart(cartToken)
        useCartStore.getState().clearCartToken()
      } catch {
        // Токен оставляем — merge можно повторить при следующей сессии.
      } finally {
        void queryClient.invalidateQueries({ queryKey: cartKeys.all })
      }
    })()
  }, [status, queryClient])

  return children
}

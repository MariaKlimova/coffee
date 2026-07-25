import { create } from 'zustand'

/**
 * Client-side cart and favorites state (stubs for later epics).
 */
interface ClientStoreState {
  /** Product ids currently in the cart. */
  cartIds: string[]
  /** Product ids marked as favorites. */
  favoriteIds: string[]
  /** Add a product id to the cart if missing. */
  addToCart: (productId: string) => void
  /** Toggle a product id in favorites. */
  toggleFavorite: (productId: string) => void
}

export const useClientStore = create<ClientStoreState>((set) => ({
  cartIds: [],
  favoriteIds: [],
  addToCart: (productId) =>
    set((state) => {
      if (state.cartIds.includes(productId)) {
        return state
      }
      return { cartIds: [...state.cartIds, productId] }
    }),
  toggleFavorite: (productId) =>
    set((state) => {
      if (state.favoriteIds.includes(productId)) {
        return {
          favoriteIds: state.favoriteIds.filter((id) => id !== productId),
        }
      }
      return { favoriteIds: [...state.favoriteIds, productId] }
    }),
}))

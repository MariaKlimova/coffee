export { addFavorite, fetchFavorites, removeFavorite } from './api/favoriteApi'
export type { Favorite, FavoriteListParams } from './api/favoriteApi.typings'
export { applyFavoriteToCaches } from './lib/applyFavoriteToCaches'
export { useFavorites, useFavoritesCount } from './model/favoriteQueries'
export {
  favoriteKeys,
  favoritesCountQueryOptions,
  favoritesQueryOptions,
} from './model/favoriteQueryOptions'
export { useFavoriteMutation } from './model/useFavoriteMutation'
export type { FavoriteMutationVariables } from './model/useFavoriteMutation'

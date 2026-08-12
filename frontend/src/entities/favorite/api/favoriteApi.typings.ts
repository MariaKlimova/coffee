/**
 * Favorite row returned by POST /api/favorites/.
 */
export interface Favorite {
  /** Favorited product UUID. */
  product_id: string
  /** When the favorite was created (ISO). */
  created_at: string
}

/**
 * Query parameters for GET /api/favorites/.
 */
export interface FavoriteListParams {
  /** 1-based page number. */
  page?: number
  /** Page size (default 20, max 100). */
  page_size?: number
}

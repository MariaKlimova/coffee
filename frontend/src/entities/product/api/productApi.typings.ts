import type { ProductCategorySlug } from '../product.const'

/**
 * Coffee-specific attributes from the API (all keys optional).
 */
export interface CoffeeApiAttributes {
  /** Origin country. */
  country?: string
  /** Intensity 0–13. */
  intensity?: number
  /** Bitterness 0–5. */
  bitterness?: number
  /** Acidity 0–5. */
  acidity?: number
  /** Roast 0–5. */
  roast?: number
  /** Density 0–5. */
  density?: number
}

/**
 * Machine-specific attributes from the API (all keys optional).
 */
export interface MachineApiAttributes {
  /** Physical dimensions text. */
  dimensions?: string
  /** Pressure in bar. */
  pressure_bar?: number
  /** Power in watts. */
  power_w?: number
  /** Capsule format name. */
  capsule_format?: string
  /** Manufacturer country. */
  manufacturer_country?: string
}

/**
 * Single gallery image on the product detail payload.
 */
export interface ProductImageDto {
  /** Absolute media URL. */
  url: string
  /** Sort order in the gallery. */
  order: number
  /** Whether this image is the cover. */
  is_main: boolean
}

/**
 * Lightweight product row for catalog grids (`ProductListItem` in OpenAPI).
 */
export interface ProductListItem {
  /** Product UUID. */
  id: string
  /** Display name. */
  name: string
  /** Unique slug used in URLs and expand state. */
  slug: string
  /** Short teaser for cards. */
  short_description: string
  /** Current price as a RUB decimal string. */
  price: string
  /** Previous price for discount display, or null. */
  old_price: string | null
  /** Category slug. */
  category: ProductCategorySlug
  /** Whether the product can be ordered. */
  in_stock: boolean
  /** Main image URL, or null when missing. */
  image_url: string | null
  /** Whether the authenticated user favorited this product. */
  is_favorite: boolean
}

/**
 * Full product payload for the expanded card / product page.
 */
export interface Product extends ProductListItem {
  /** Optional long description. */
  description: string
  /** Category-specific attribute bag. */
  attributes: CoffeeApiAttributes | MachineApiAttributes
  /** Full gallery. */
  images: ProductImageDto[]
  /** Creation timestamp (ISO). */
  created_at: string
  /** Last update timestamp (ISO). */
  updated_at: string
}

/**
 * DRF page-number pagination envelope.
 */
export interface Paginated<T> {
  /** Total number of items across all pages. */
  count: number
  /** Absolute URL of the next page, or null. */
  next: string | null
  /** Absolute URL of the previous page, or null. */
  previous: string | null
  /** Items on the current page. */
  results: T[]
}

/**
 * Allowed `ordering` values for `GET /api/products/`.
 */
export type ProductOrdering = 'price' | '-price' | 'created_at' | '-created_at'

/**
 * Query parameters for the product list endpoint.
 */
export interface ProductListParams {
  /** Category slug filter. */
  category?: ProductCategorySlug
  /** Availability filter. */
  in_stock?: boolean
  /** Minimum price (RUB decimal string). */
  price_min?: string
  /** Maximum price (RUB decimal string). */
  price_max?: string
  /** Name search (icontains). */
  search?: string
  /** Sort order. */
  ordering?: ProductOrdering
  /** 1-based page number. */
  page?: number
  /** Page size (default 20, max 100). */
  page_size?: number
}

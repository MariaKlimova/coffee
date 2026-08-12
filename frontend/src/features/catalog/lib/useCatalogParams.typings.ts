/**
 * Inputs for jumping the storefront to a product on a known page.
 */
export interface OpenProductAtOptions {
  /** Product slug to expand. */
  slug: string
  /** 1-based catalog page that contains the product. */
  page: number
  /** When true, clears price and stock filters while keeping ordering. */
  resetFilters: boolean
}

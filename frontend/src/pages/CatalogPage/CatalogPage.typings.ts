import type { ProductCategorySlug } from '@entities/product'

/**
 * Props for the shared coffee / machines storefront page.
 */
export interface CatalogPageProps {
  /** Category slug fixed by the route (`/coffee` or `/machines`). */
  category: ProductCategorySlug
}

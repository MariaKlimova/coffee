export { fetchProduct, fetchProducts } from './api/productApi'
export type {
  CoffeeApiAttributes,
  MachineApiAttributes,
  Paginated,
  Product,
  ProductImageDto,
  ProductListItem,
  ProductListParams,
  ProductOrdering,
} from './api/productApi.typings'
export { toExpandedCardProps } from './lib/toExpandedCardProps'
export { toProductCardProps } from './lib/toProductCardProps'
export { productKeys, useProduct, useProducts } from './model/productQueries'
export { CATALOG_PAGE_SIZE, CATEGORY_LABELS } from './product.const'
export type { ProductCategorySlug } from './product.const'

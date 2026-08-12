export { fetchProduct, fetchProducts, fetchRelatedProducts } from './api/productApi'
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
export { findProductPage } from './model/findProductPage'
export type { FindProductPageParams } from './model/findProductPage'
export {
  useProduct,
  useProductPageNumber,
  useProducts,
  useRelatedProducts,
} from './model/productQueries'
export { productKeys } from './model/productQueryOptions'
export {
  CATALOG_PAGE_SIZE,
  CATEGORY_LABELS,
  CATEGORY_ROUTES,
  DEFAULT_CATALOG_ROUTE,
} from './product.const'
export type { ProductCategorySlug } from './product.const'

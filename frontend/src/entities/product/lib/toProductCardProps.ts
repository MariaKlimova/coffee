import { formatMoney } from '@shared/lib/formatMoney'
import type { ProductCardProps } from '@shared/ui'

import type { ProductListItem } from '../api/productApi.typings'
import { CATEGORY_LABELS } from '../product.const'

/**
 * Maps a list item DTO to ProductCard props.
 *
 * `id` is the product UUID (for cart/favorites callbacks later).
 * Expand/URL state must use `slug` separately — do not pass card `id` into `?product=`.
 */
export function toProductCardProps(
  product: ProductListItem,
): Pick<
  ProductCardProps,
  | 'id'
  | 'categoryLabel'
  | 'title'
  | 'description'
  | 'images'
  | 'price'
  | 'oldPrice'
  | 'inStock'
  | 'isFavorite'
> {
  return {
    id: product.id,
    categoryLabel: CATEGORY_LABELS[product.category],
    title: product.name,
    description: product.short_description,
    images: product.image_url ? [product.image_url] : [],
    price: formatMoney(product.price),
    oldPrice: product.old_price ? formatMoney(product.old_price) : undefined,
    inStock: product.in_stock,
    isFavorite: product.is_favorite,
  }
}

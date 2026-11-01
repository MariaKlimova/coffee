import { formatMoney } from '@shared/lib/formatMoney'
import type { ProductCardProps } from '@shared/ui'

import type { ProductListItem } from '../api/productApi.typings'
import { CATEGORY_LABELS } from '../product.const'
import { resolveProductImages } from './resolveProductImages'

/**
 * Maps a list item DTO to ProductCard props.
 *
 * `id` is the product UUID (for cart/favorites callbacks later).
 * Ссылка на товар строится по slug отдельно от UUID для действий с корзиной.
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
    images: resolveProductImages(product),
    price: formatMoney(product.price),
    oldPrice: product.old_price ? formatMoney(product.old_price) : undefined,
    inStock: product.in_stock,
    isFavorite: product.is_favorite,
  }
}

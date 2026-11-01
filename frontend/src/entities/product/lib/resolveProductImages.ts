import type { Product, ProductListItem } from '../api/productApi.typings'
import { DEMO_CATALOG_IMAGES } from './demoCatalogImages.const'

type ProductMediaSource = Pick<ProductListItem, 'id' | 'image_url'> &
  Partial<Pick<Product, 'images'>>

/** Реальные фото приоритетны; демо-иллюстрации доступны только явно включённому стенду. */
export function resolveProductImages(product: ProductMediaSource): string[] {
  const gallery = (product.images ?? []).map((image) => image.url).filter(Boolean)
  if (gallery.length > 0) {
    return gallery
  }
  if (product.image_url) {
    return [product.image_url]
  }
  if (import.meta.env.VITE_ENABLE_DEMO_CATALOG_IMAGES !== 'true') {
    return []
  }
  const demoImage = DEMO_CATALOG_IMAGES.get(product.id)
  return demoImage ? [demoImage] : []
}

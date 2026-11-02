import type { Product, ProductListItem } from '../api/productApi.typings'
import { DEMO_CATALOG_IMAGES } from './demoCatalogImages.const'

type ProductMediaSource = Pick<ProductListItem, 'id' | 'image_url' | 'origin'> &
  Partial<Pick<Product, 'images'>>

/** Сервер управляет демо; флаг стенда поддерживает прежнюю версию API. */
export function resolveProductImages(product: ProductMediaSource): string[] {
  const gallery = (product.images ?? [])
    .filter((image) => product.origin !== 'owner' || !image.is_mock)
    .map((image) => image.url)
    .filter(Boolean)
  if (gallery.length > 0) {
    return gallery
  }
  if (product.image_url) {
    return [product.image_url]
  }
  if (product.origin === 'owner') {
    return []
  }
  if (
    product.origin !== 'demo' &&
    import.meta.env.VITE_ENABLE_DEMO_CATALOG_IMAGES !== 'true'
  ) {
    return []
  }
  const demoImage = DEMO_CATALOG_IMAGES.get(product.id)
  return demoImage ? [demoImage] : []
}

import { toProductCardProps } from '@entities/product'
import { useCartLineActions } from '@features/add-to-cart'
import { useToggleFavorite } from '@features/toggle-favorite'
import { ProductCard } from '@shared/ui'

import type { CatalogPageItemProps } from './CatalogPage-Item.typings'

export function CatalogPageItem({
  product,
  href,
  linkState,
  onOpen,
}: CatalogPageItemProps) {
  const { toggleFavorite } = useToggleFavorite()
  const { getQuantity, setQuantity, addToCart } = useCartLineActions()

  return (
    <ProductCard
      {...toProductCardProps(product)}
      href={href}
      linkState={linkState}
      onExpand={onOpen}
      cartQuantity={getQuantity(product.id)}
      onToggleFavorite={(productId) => toggleFavorite(productId, product.is_favorite)}
      onAddToCart={(productId) => addToCart(productId, 1)}
      onCartQuantityChange={setQuantity}
    />
  )
}

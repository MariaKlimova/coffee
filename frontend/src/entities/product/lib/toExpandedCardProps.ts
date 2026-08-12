import { formatMoney } from '@shared/lib/formatMoney'
import type { ExpandedCoffeeCardProps, ExpandedMachineCardProps } from '@shared/ui'

import type {
  CoffeeApiAttributes,
  MachineApiAttributes,
  Product,
} from '../api/productApi.typings'
import { CATEGORY_LABELS, MISSING_ATTRIBUTE } from '../product.const'

type ExpandedCardMappedProps =
  | Omit<
      ExpandedCoffeeCardProps,
      'onClose' | 'similarSlot' | 'className' | 'onToggleFavorite'
    >
  | Omit<
      ExpandedMachineCardProps,
      'onClose' | 'similarSlot' | 'className' | 'onToggleFavorite'
    >

function textOrMissing(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    return MISSING_ATTRIBUTE
  }
  return trimmed
}

function scaleOrZero(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return value
}

function mapCoffeeAttributes(attributes: CoffeeApiAttributes | undefined) {
  return {
    originCountry: textOrMissing(attributes?.country),
    intensity: scaleOrZero(attributes?.intensity),
    bitterness: scaleOrZero(attributes?.bitterness),
    acidity: scaleOrZero(attributes?.acidity),
    roast: scaleOrZero(attributes?.roast),
    density: scaleOrZero(attributes?.density),
  }
}

function mapMachineAttributes(attributes: MachineApiAttributes | undefined) {
  return {
    dimensions: textOrMissing(attributes?.dimensions),
    pressureBar:
      typeof attributes?.pressure_bar === 'number'
        ? `${attributes.pressure_bar} бар`
        : MISSING_ATTRIBUTE,
    powerW:
      typeof attributes?.power_w === 'number'
        ? `${attributes.power_w} Вт`
        : MISSING_ATTRIBUTE,
    capsuleFormat: textOrMissing(attributes?.capsule_format),
    manufacturerCountry: textOrMissing(attributes?.manufacturer_country),
  }
}

/**
 * Maps a product detail DTO to ExpandedProductCard props (without handlers/slots).
 */
export function toExpandedCardProps(product: Product): ExpandedCardMappedProps {
  let images = (product.images ?? []).map((image) => image.url)
  if (images.length === 0 && product.image_url) {
    images = [product.image_url]
  }

  const base = {
    id: product.id,
    categoryLabel: CATEGORY_LABELS[product.category],
    title: product.name,
    description: product.description || product.short_description,
    images,
    price: formatMoney(product.price),
    oldPrice: product.old_price ? formatMoney(product.old_price) : undefined,
    isFavorite: product.is_favorite,
  }

  if (product.category === 'coffee') {
    return {
      ...base,
      category: 'coffee',
      attributes: mapCoffeeAttributes(product.attributes as CoffeeApiAttributes),
    }
  }

  return {
    ...base,
    category: 'machines',
    attributes: mapMachineAttributes(product.attributes as MachineApiAttributes),
  }
}

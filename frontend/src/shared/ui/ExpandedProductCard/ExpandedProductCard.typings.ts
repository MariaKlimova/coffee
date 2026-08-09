import type { HTMLAttributes, ReactNode } from 'react'

/**
 * Coffee tasting attributes for expanded card.
 */
export interface CoffeeAttributes {
  /** Origin country text. */
  originCountry: string
  /** Intensity 0–13. */
  intensity: number
  /** Bitterness 0–5. */
  bitterness: number
  /** Acidity 0–5. */
  acidity: number
  /** Roast 0–5. */
  roast: number
  /** Density 0–5. */
  density: number
}

/**
 * Machine attributes for expanded card.
 */
export interface MachineAttributes {
  /** Dimensions text. */
  dimensions: string
  /** Pressure in bar. */
  pressureBar: string
  /** Power in watts. */
  powerW: string
  /** Capsule format. */
  capsuleFormat: string
  /** Manufacturer country. */
  manufacturerCountry: string
}

interface ExpandedProductCardBase extends Omit<
  HTMLAttributes<HTMLElement>,
  'id' | 'title'
> {
  /** Product id; also used to link the title with the card for screen readers. */
  id: string
  /** Category label shown as overline. */
  categoryLabel: string
  /** Product title. */
  title: string
  /** Full description. */
  description: string
  /** Image URLs. */
  images: string[]
  /** Current price label. */
  price: string
  /** Optional previous price. */
  oldPrice?: string
  /** Close handler (× button or Escape). */
  onClose: () => void
  /** Optional similar-products slot (COFFEE-25). */
  similarSlot?: ReactNode
}

export interface ExpandedCoffeeCardProps extends ExpandedProductCardBase {
  /** Coffee category discriminator. */
  category: 'coffee'
  /** Coffee attribute block. */
  attributes: CoffeeAttributes
}

export interface ExpandedMachineCardProps extends ExpandedProductCardBase {
  /** Machines category discriminator. */
  category: 'machines'
  /** Machine attribute block. */
  attributes: MachineAttributes
}

export type ExpandedProductCardProps =
  ExpandedCoffeeCardProps | ExpandedMachineCardProps

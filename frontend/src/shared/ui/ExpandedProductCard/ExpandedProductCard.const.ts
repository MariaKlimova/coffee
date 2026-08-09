import type { CoffeeAttributes, MachineAttributes } from './ExpandedProductCard.typings'

/**
 * Numeric tasting scales rendered as segmented bars.
 */
export const COFFEE_SCALES: Array<{
  /** Attribute key holding the numeric value. */
  key: Exclude<keyof CoffeeAttributes, 'originCountry'>
  /** Visible label. */
  label: string
  /** Upper bound of the scale. */
  max: number
}> = [
  { key: 'intensity', label: 'Интенсивность', max: 13 },
  { key: 'bitterness', label: 'Горечь', max: 5 },
  { key: 'acidity', label: 'Кислотность', max: 5 },
  { key: 'roast', label: 'Обжарка', max: 5 },
  { key: 'density', label: 'Плотность', max: 5 },
]

/**
 * Machine spec rows rendered as a definition-like list.
 */
export const MACHINE_ROWS: Array<{
  /** Attribute key holding the value. */
  key: keyof MachineAttributes
  /** Visible label. */
  label: string
}> = [
  { key: 'dimensions', label: 'Размеры' },
  { key: 'pressureBar', label: 'Давление' },
  { key: 'powerW', label: 'Мощность' },
  { key: 'capsuleFormat', label: 'Формат капсул' },
  { key: 'manufacturerCountry', label: 'Страна' },
]

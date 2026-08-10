import type { HeaderNavItem } from './Header.typings'

/** Primary navigation links. */
export const HEADER_NAV_ITEMS: HeaderNavItem[] = [
  { to: '/', label: 'Главная' },
  { to: '/coffee', label: 'Кофе' },
  { to: '/machines', label: 'Кофемашины' },
  { to: '/#contacts', label: 'Контакты' },
]

/** Maximum numeric value shown in header counters before clamping. */
export const HEADER_COUNTER_MAX = 99

/**
 * Formats a counter for the header badge.
 */
export function formatHeaderCount(count: number): string {
  if (count <= HEADER_COUNTER_MAX) {
    return String(count)
  }
  return `${HEADER_COUNTER_MAX}+`
}

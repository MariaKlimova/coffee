import { APP_ROUTES } from '@shared/config'
import { NAV_COPY } from '@shared/lib/copy'

import type { HeaderNavItem } from './Header.typings'

/** Primary navigation links. */
export const HEADER_NAV_ITEMS: HeaderNavItem[] = [
  { to: APP_ROUTES.home, label: NAV_COPY.home },
  { to: APP_ROUTES.coffee, label: NAV_COPY.coffee },
  { to: APP_ROUTES.machines, label: NAV_COPY.machines },
  { to: APP_ROUTES.contacts, label: NAV_COPY.contacts },
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

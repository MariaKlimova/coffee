import { SITE_TITLE } from '@shared/config'

/**
 * Tab title for an expanded product card.
 */
export function buildProductTitle(name: string): string {
  return `${name} — ${SITE_TITLE}`
}

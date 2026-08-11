/**
 * Site name appended to the tab title — matches the static title in index.html.
 */
const SITE_TITLE = 'Coffee Shop'

/**
 * Tab title for an expanded product card.
 */
export function buildProductTitle(name: string): string {
  return `${name} — ${SITE_TITLE}`
}

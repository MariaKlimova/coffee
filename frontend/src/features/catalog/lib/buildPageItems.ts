/**
 * One item in the truncated pagination list.
 */
export type PageItem =
  | {
      /** Page number button. */
      type: 'page'
      /** 1-based page number. */
      page: number
    }
  | {
      /** Ellipsis marker between distant page ranges. */
      type: 'ellipsis'
      /** Stable key for React lists. */
      key: string
    }

/**
 * Builds a truncated page list like `1 … 4 5 6 … 12`.
 */
export function buildPageItems(current: number, total: number): PageItem[] {
  if (total <= 1) {
    return total === 1 ? [{ type: 'page', page: 1 }] : []
  }

  const windowSize = 1
  const pages = new Set<number>()
  pages.add(1)
  pages.add(total)

  for (let page = current - windowSize; page <= current + windowSize; page += 1) {
    if (page >= 1 && page <= total) {
      pages.add(page)
    }
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const items: PageItem[] = []

  for (let index = 0; index < sorted.length; index += 1) {
    const page = sorted[index]
    const previous = sorted[index - 1]
    if (previous !== undefined && page - previous > 1) {
      items.push({ type: 'ellipsis', key: `ellipsis-${previous}-${page}` })
    }
    items.push({ type: 'page', page })
  }

  return items
}

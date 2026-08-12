/**
 * Parses a 1-based page number from a URL search param.
 * Invalid or missing values fall back to 1.
 */
export function parsePageNumber(raw: string | null | undefined): number {
  if (!raw) {
    return 1
  }
  const page = Number.parseInt(raw, 10)
  if (!Number.isFinite(page) || page < 1) {
    return 1
  }
  return page
}

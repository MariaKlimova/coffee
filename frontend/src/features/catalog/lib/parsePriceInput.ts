/**
 * Parses a non-negative decimal price string for catalog filters / URL.
 * Empty or invalid input becomes `undefined` (filter cleared / ignored).
 */
export function parsePriceInput(raw: string | null | undefined): string | undefined {
  if (raw == null) {
    return undefined
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return undefined
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return undefined
  }
  return trimmed
}

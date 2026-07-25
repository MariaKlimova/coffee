/**
 * Joins class names, skipping falsy values.
 */
export function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ')
}

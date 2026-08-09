/**
 * Props for a single tasting scale row.
 */
export interface ScaleRowProps {
  /** Visible scale label. */
  label: string
  /** Current value; clamped to the 0…max range. */
  value: number
  /** Upper bound / number of segments. */
  max: number
}

/**
 * Props for the shared heart icon.
 */
export interface HeartIconProps {
  /** When true, the heart is filled (favorited state). */
  filled?: boolean
}

/** Heart icon used on product cards and in the header. */
export function HeartIcon({ filled = false }: HeartIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 20s-7-4.35-7-9.2A3.8 3.8 0 0 1 12 7.2a3.8 3.8 0 0 1 7 3.6C19 15.65 12 20 12 20Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

import { useEffect, useState } from 'react'

/**
 * Tracks whether the primary pointer is coarse (touch) — arrows stay visible there,
 * because hover is unavailable. Falls back to `false` when matchMedia is missing.
 */
export function useCoarsePointer(): boolean {
  const [isCoarse, setIsCoarse] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return
    }
    const media = window.matchMedia('(hover: none), (pointer: coarse)')
    const sync = () => {
      setIsCoarse(media.matches)
    }
    sync()
    media.addEventListener('change', sync)
    return () => {
      media.removeEventListener('change', sync)
    }
  }, [])

  return isCoarse
}

import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const positions = new Map<string, number>()
const STORAGE_PREFIX = 'coffee:catalogScroll:v1:'

function savedPosition(key: string): number | undefined {
  const cached = positions.get(key)
  if (cached !== undefined) return cached
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`)
    if (raw === null) return
    const value = Number(raw)
    if (Number.isFinite(value) && value >= 0) return value
  } catch {
    // При недоступном storage работает память текущей вкладки.
  }
}

/** Восстанавливает scroll после появления списка, включая browser Back. */
export function useCatalogReturn(ready: boolean) {
  const location = useLocation()
  const scrollKey = `${location.key}:${location.pathname}${location.search}`
  const restoredKey = useRef<string | null>(null)
  const state = location.state as { catalogScrollY?: unknown } | null
  const returnScroll = state?.catalogScrollY

  useLayoutEffect(() => {
    if (!ready || restoredKey.current === scrollKey) return
    const position =
      typeof returnScroll === 'number' &&
      Number.isFinite(returnScroll) &&
      returnScroll >= 0
        ? returnScroll
        : savedPosition(scrollKey)
    if (position !== undefined) window.scrollTo({ top: position, behavior: 'instant' })
    restoredKey.current = scrollKey
  }, [ready, scrollKey, returnScroll])

  function rememberScroll(): void {
    const position = window.scrollY
    positions.set(scrollKey, position)
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}${scrollKey}`, String(position))
    } catch {
      // Ссылка и возврат остаются рабочими без sessionStorage.
    }
  }

  return {
    rememberScroll,
    productLinkState: { catalogLocationKey: scrollKey },
  }
}

/** Положение исходного каталога для явной ссылки возврата. */
export function getCatalogScroll(state: unknown): number | undefined {
  if (!state || typeof state !== 'object' || !('catalogLocationKey' in state)) return
  return typeof state.catalogLocationKey === 'string'
    ? savedPosition(state.catalogLocationKey)
    : undefined
}

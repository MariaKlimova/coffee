import { APP_ROUTES } from '@shared/config'

/** Принимает только ссылки в каталог; старый product не переносится обратно. */
export function safeCatalogReturn(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return
  try {
    const url = new URL(raw, 'https://catalog.invalid')
    if (url.origin !== 'https://catalog.invalid') return
    if (url.pathname !== APP_ROUTES.coffee && url.pathname !== APP_ROUTES.machines)
      return
    url.searchParams.delete('product')
    url.searchParams.delete('returnTo')
    return `${url.pathname}${url.search}`
  } catch {
    return
  }
}

/** Ссылка доступна и при открытии в новой вкладке, без router state. */
export function productPath(slug: string, returnTo?: string): string {
  const path = `/product/${encodeURIComponent(slug)}`
  const safeReturn = safeCatalogReturn(returnTo)
  return safeReturn ? `${path}?${new URLSearchParams({ returnTo: safeReturn })}` : path
}

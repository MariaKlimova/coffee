/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Django API (no trailing slash). */
  readonly VITE_API_BASE_URL: string
  /** Статические иллюстрации только для явно импортированных демо-товаров. */
  readonly VITE_ENABLE_DEMO_CATALOG_IMAGES?: string
}

interface ImportMeta {
  /** Vite-injected environment variables. */
  readonly env: ImportMetaEnv
}

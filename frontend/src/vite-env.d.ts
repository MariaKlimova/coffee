/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Django API (no trailing slash). */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  /** Vite-injected environment variables. */
  readonly env: ImportMetaEnv
}

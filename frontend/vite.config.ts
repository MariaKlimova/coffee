import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      '@app': path.resolve(rootDir, 'src/app'),
      '@pages': path.resolve(rootDir, 'src/pages'),
      '@entities': path.resolve(rootDir, 'src/entities'),
      '@features': path.resolve(rootDir, 'src/features'),
      '@shared': path.resolve(rootDir, 'src/shared'),
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    globals: true,
    setupFiles: ['./src/shared/lib/test/setup.ts'],
  },
})

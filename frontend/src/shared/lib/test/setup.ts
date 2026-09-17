import '@testing-library/jest-dom/vitest'

/**
 * Node 25 may expose a broken experimental `localStorage` (see
 * `--localstorage-file` warnings) that overrides jsdom's implementation.
 * Provide an in-memory stub so auth/cart token storage works in tests.
 * Same for `sessionStorage` (pending order id after payment redirect).
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

const memoryLocalStorage = createMemoryStorage()
const memorySessionStorage = createMemoryStorage()

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  enumerable: true,
  value: memoryLocalStorage,
  writable: true,
})

Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  enumerable: true,
  value: memorySessionStorage,
  writable: true,
})

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    enumerable: true,
    value: memoryLocalStorage,
    writable: true,
  })
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    enumerable: true,
    value: memorySessionStorage,
    writable: true,
  })
}

// Minimal in-memory localStorage mock
export function setupLocalStorageMock() {
  const store = new Map<string, string>()

  const localStorageMock: Storage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number): string | null {
      const keys = Array.from(store.keys())
      return index >= 0 && index < keys.length ? (keys[index] ?? null) : null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  } satisfies Storage // satisfy TS "Storage" without implementing every nuance

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorageMock,
    writable: true,
  })

  return store
}

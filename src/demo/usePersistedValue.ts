import { useMemo, useState } from 'react'

export function usePersistedValue<T>(key: string, initialValue: T, transform?: (v: unknown) => T) {
  const [value, setValue] = useState(() => {
    const persisted = localStorage.getItem(key)
    const parsed = persisted ? JSON.parse(persisted) : null
    return parsed !== null && parsed !== undefined ? (transform?.(parsed) ?? parsed) : initialValue
  })
  useMemo(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue] as const
}

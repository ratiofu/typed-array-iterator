type TimedValue<T> = {
  value: T
  millis: number
}

export function timedValue<T>(fn: () => T): TimedValue<T> {
  const start = performance.now()
  const value = fn()
  const end = performance.now()
  return { millis: end - start, value }
}

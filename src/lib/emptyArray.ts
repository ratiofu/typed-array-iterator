const emptyArraySingleton: readonly unknown[] = Object.freeze([])

export function emptyArray<T>(): readonly T[] {
  return emptyArraySingleton as readonly T[]
}

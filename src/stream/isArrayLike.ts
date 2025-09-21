export function isArrayLike(candidate: unknown): candidate is ArrayLike<unknown> {
  // Fast paths: Array, TypedArrays (but not DataView)
  if (Array.isArray(candidate)) return true
  if (ArrayBuffer?.isView(candidate as unknown)) {
    // Exclude DataView: it's a view but not indexable like arrays
    return !(candidate instanceof globalThis.DataView)
  }
  // Strings are indexable and have length
  if (typeof candidate === 'string') return true

  // Generic array-like: has finite, non-negative length and index 0 may exist when length > 0
  const arrayLike = candidate as ArrayLike<unknown>
  if (typeof arrayLike?.length === 'number') {
    const { length } = arrayLike
    if (Number.isFinite(length) && length >= 0) {
      return length === 0 || 0 in arrayLike
    }
  }
  return false
}

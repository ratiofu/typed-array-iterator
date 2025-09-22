import { describe, expect, test } from 'bun:test'
import { isArrayLike } from './isArrayLike.ts'

describe('isArrayLike', () => {
  test('arrays and typed arrays are true; DataView is false', () => {
    expect(isArrayLike([1, 2, 3])).toBe(true)
    expect(isArrayLike(new Uint8Array([1, 2]))).toBe(true)
    const ab = new ArrayBuffer(8)
    const dv = new DataView(ab)
    expect(isArrayLike(dv)).toBe(false)
  })

  test('strings are true', () => {
    expect(isArrayLike('abc')).toBe(true)
  })

  test('generic array-like length logic', () => {
    // length = 0 is allowed
    expect(isArrayLike({ length: 0 })).toBe(true)

    // length > 0 requires index 0 to exist
    expect(isArrayLike({ length: 2 })).toBe(false)
    expect(isArrayLike({ 0: 'x', length: 2 })).toBe(true)

    // invalid lengths
    expect(isArrayLike({ length: -1 })).toBe(false)
    expect(isArrayLike({ length: Infinity })).toBe(false)
    expect(isArrayLike({ length: Number.NaN })).toBe(false)
  })
})

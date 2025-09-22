import { describe, expect, test } from 'bun:test'
import type { Op } from '../types'
import { compileEvery } from './compileEvery.ts'

describe('compileEvery', () => {
  test('arraylike: true when all match after ops', () => {
    const ops: Op[] = [
      { kind: 'map', fn: (v) => (v as number) * 2 },
      { kind: 'filter', fn: (v) => (v as number) > 0 },
    ]
    const pred = (v: unknown) => (v as number) % 2 === 0
    const run = compileEvery(true, ops, pred)
    expect(run([1, 2, 3])).toBe(true) // 2,4,6 all even
  })

  test('iterable: false when at least one fails', () => {
    const ops: Op[] = [{ kind: 'map', fn: (v) => (v as number) + 1 }]
    const pred = (v: unknown) => (v as number) < 4
    const run = compileEvery(false, ops, pred)
    expect(run(new Set([1, 2, 10]))).toBe(false) // 2,3,11 -> 11 fails
  })
})

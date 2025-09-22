import { describe, expect, test } from 'bun:test'
import type { Op } from '../types'
import { compileSome } from './compileSome.ts'

describe('compileSome', () => {
  test('arraylike: true when any matches after ops', () => {
    const ops: Op[] = [{ kind: 'map', fn: (v) => (v as number) + 1 }]
    const pred = (v: unknown) => (v as number) === 3
    const run = compileSome(true, ops, pred)
    expect(run([1, 2, 10])).toBe(true) // 2,3,11 => matches 3
  })

  test('iterable: false when none match', () => {
    const ops: Op[] = [{ kind: 'filter', fn: (v) => (v as number) > 100 }]
    const pred = (v: unknown) => (v as number) % 2 === 0
    const run = compileSome(false, ops, pred)
    expect(run(new Set([1, 2, 3, 4]))).toBe(false)
  })
})

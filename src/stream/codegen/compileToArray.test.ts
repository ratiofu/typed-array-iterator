import { describe, expect, test } from 'bun:test'
import type { Op } from '../types'
import { compileToArray } from './compileToArray.ts'

const double: (v: unknown, i: number) => unknown = (v) => (v as number) * 2
const isEven: (v: unknown, i: number) => boolean = (v) => ((v as number) & 1) === 0

describe('compileToArray', () => {
  test('arraylike path: map + filter', () => {
    const ops: Op[] = [
      { kind: 'map', fn: double },
      { kind: 'filter', fn: isEven },
    ]
    const run = compileToArray(true, ops)
    const out = run([1, 2, 3, 4]) as number[]
    // map *2 => [2,4,6,8]; filter even keeps all
    expect(out).toEqual([2, 4, 6, 8])
  })

  test('iterable path: filter only', () => {
    const ops: Op[] = [{ kind: 'filter', fn: isEven }]
    const run = compileToArray(false, ops)
    const src = new Set([1, 2, 3, 4])
    const out = run(src) as number[]
    expect(out).toEqual([2, 4])
  })
})

import { describe, expect, test } from 'bun:test'
import type { Op } from '../types'
import { compileForEach } from './compileForEach.ts'

describe('compileForEach', () => {
  test('arraylike: applies ops and calls sink with emitted index', () => {
    const seen: [unknown, number][] = []
    const sink = (v: unknown, i: number) => seen.push([v, i])
    const ops: Op[] = [
      { kind: 'map', fn: (v) => (v as number) + 1 },
      { kind: 'filter', fn: (v) => (v as number) > 2 },
    ]
    const run = compileForEach(true, ops, sink)
    run([1, 2, 3])
    expect(seen).toEqual([
      // 1+1=2 -> filtered out, so no sink
      [3, 0], // 2+1=3
      [4, 1], // 3+1=4
    ])
  })

  test('iterable: iterates with for..of and respects ops', () => {
    const seen: unknown[] = []
    const sink = (v: unknown) => seen.push(v)
    const ops: Op[] = [
      { kind: 'map', fn: (v) => (v as number) * 3 },
      { kind: 'filter', fn: (v) => (v as number) % 2 === 0 },
    ]
    const run = compileForEach(false, ops, sink)
    run(new Set([1, 2, 3, 4]))
    // 1*3=3 skip, 2*3=6 take, 3*3=9 skip, 4*3=12 take
    expect(seen).toEqual([6, 12])
  })
})

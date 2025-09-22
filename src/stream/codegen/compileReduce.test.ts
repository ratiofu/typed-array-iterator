import { describe, expect, test } from 'bun:test'
import type { Op } from '../types'
import { compileReduce } from './compileReduce.ts'

describe('compileReduce', () => {
  test('arraylike: sum with initial value', () => {
    const ops: Op[] = [{ kind: 'filter', fn: (v) => (v as number) > 0 }]
    const reducer = (acc: unknown, v: unknown) => (acc as number) + (v as number)
    const run = compileReduce(true, ops, reducer, true, 10)
    expect(run([1, -2, 3])).toBe(14) // (1 + 3) + 10
  })

  test('iterable: sum without initial value', () => {
    const ops: Op[] = [{ kind: 'map', fn: (v) => (v as number) * 2 }]
    const reducer = (acc: unknown, v: unknown) => (acc as number) + (v as number)
    const run = compileReduce(false, ops, reducer, false, undefined)
    expect(run(new Set([1, 2, 3]))).toBe(12) // start=2, then +4 +6
  })

  test('throws on empty source without initial', () => {
    const ops: Op[] = []
    const reducer = (acc: unknown, v: unknown) => (acc as number) + (v as number)
    const run = compileReduce(true, ops, reducer, false, undefined)
    expect(() => run([])).toThrow('Reduce of empty stream with no initial value')
  })
})

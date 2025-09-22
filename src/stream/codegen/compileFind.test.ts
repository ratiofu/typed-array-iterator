import { describe, expect, test } from 'bun:test'
import type { Op } from '../types'
import { compileFind } from './compileFind.ts'

describe('compileFind', () => {
  test('arraylike: returns first matching after ops', () => {
    const ops: Op[] = [{ kind: 'map', fn: (v) => (v as number) + 1 }]
    const pred = (v: unknown) => (v as number) > 3
    const run = compileFind(true, ops, pred)
    expect(run([1, 2, 3, 4])).toBe(4) // 2,3,4,5 => first >3 is 4
  })

  test('iterable: returns undefined when none match', () => {
    const ops: Op[] = [{ kind: 'filter', fn: (v) => (v as number) < 0 }]
    const pred = (_: unknown) => true
    const run = compileFind(false, ops, pred)
    expect(run(new Set([1, 2, 3]))).toBeUndefined()
  })
})

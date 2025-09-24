import { describe, expect, test } from 'bun:test'
import { emitArrayLoop, emitIterableLoop, hasNoMatchOps } from './compiler'
import { noMatch } from './noMatch'
import type { Op } from './types'

// These smoke tests ensure both emitters are executed for coverage.
describe('stream/shared emitters', () => {
  test('emitArrayLoop returns code string', () => {
    const code = emitArrayLoop([], 'result[emittedIndex++] = currentValue')
    expect(typeof code).toBe('string')
    expect(code).toContain('for (let index = 0;')
  })

  test('emitIterableLoop returns code string (no index)', () => {
    const code = emitIterableLoop([], 'sink(currentValue)', false)
    expect(typeof code).toBe('string')
    expect(code).toContain('for (const currentValueRaw of data)')
  })

  test('hasNoMatchOps detects noMatch filter', () => {
    const ops: Op[] = [{ kind: 'filter', fn: noMatch }]
    expect(hasNoMatchOps(ops)).toBe(true)
    expect(noMatch()).toBe(false)
  })
})

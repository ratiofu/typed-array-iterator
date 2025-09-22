import type { Op } from '../types'

import { buildOpsUnrolled, emitArrayLoop, emitIterableLoop } from './shared'

const TERMINAL = `  if (started) {
    accumulator = reducer(accumulator, currentValue, emittedIndex++)
  } else {
    accumulator = currentValue
    started = true
    emittedIndex++
  }`

/**
 * Compile a specialized `reduce` terminal.
 *
 * Relationship to overall compilation:
 * - Injects the fused map/filter pipeline before invoking the user-provided reducer.
 * - Handles both cases: with initialValue and without (using first emitted value as seed).
 * - Chooses array-indexed vs iterable loop via isArrayLikeSource.
 */
export function compileReduce(
  isArrayLikeSource: boolean,
  ops: readonly Op[],
  reducer: (accumulator: unknown, value: unknown, index: number) => unknown,
  hasInitial: boolean,
  initialValue: unknown
): (source: Iterable<unknown> | ArrayLike<unknown>) => unknown {
  const { argNames, argValues, lines } = buildOpsUnrolled(ops)
  const srcArgs = ['data', 'reducer', 'hasInitial', 'initialValue', ...argNames]
  const body = `
let started = hasInitial
let accumulator = initialValue
${isArrayLikeSource ? emitArrayLoop(lines, TERMINAL) : emitIterableLoop(lines, TERMINAL)}
if (!started) { throw new TypeError("Reduce of empty stream with no initial value") }
return accumulator
`
  const fn = new Function(...srcArgs, body)
  return (source) => fn(source, reducer, hasInitial, initialValue, ...argValues)
}

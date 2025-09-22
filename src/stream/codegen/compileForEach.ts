import type { Op } from '../types'
import { buildOpsUnrolled } from './shared'

/**
 * Compile a specialized `forEach` terminal.
 *
 * Relationship to overall compilation:
 * - Uses buildOpsUnrolled() to emit the fused map/filter pipeline as raw JS lines.
 * - Chooses the loop strategy based on isArrayLikeSource:
 *   - true: index-based loop over `data[i]` (fast path)
 *   - false: generic `for..of` over an Iterable
 * - The generated function accepts the original source and all op functions as parameters.
 */
export function compileForEach(
  isArrayLikeSource: boolean,
  ops: readonly Op[],
  sink: (value: unknown, index: number) => void
): (source: Iterable<unknown> | ArrayLike<unknown>) => void {
  const { argNames, argValues, lines } = buildOpsUnrolled(ops)

  if (isArrayLikeSource) {
    const srcArgs = ['data', 'sink', ...argNames]
    const body = `
const dataLength = data.length
let logicalIndex = 0
let emittedIndex = 0
for (let i = 0; i < dataLength; i++) {
  let currentValue = data[i]
  const index = logicalIndex++
  ${lines.map((l) => `  ${l}`).join('\n')}
  sink(currentValue, emittedIndex++)
}
    `
    const fn = new Function(...srcArgs, body) as (
      data: ArrayLike<unknown>,
      sink: (v: unknown, i: number) => void,
      ...fns: Function[]
    ) => void
    return (source) => fn(source as ArrayLike<unknown>, sink, ...argValues)
  }

  // iterable path: for...of
  const srcArgs = ['iterable', 'sink', ...argNames]
  const body = `
let logicalIndex = 0
let emittedIndex = 0
for (const currentValueRaw of iterable) {
  let currentValue = currentValueRaw
  const index = logicalIndex++
  ${lines.map((l) => `  ${l}`).join('\n')}
  sink(currentValue, emittedIndex++)
}
  `
  const fn = new Function(...srcArgs, body) as (
    iterable: Iterable<unknown>,
    sink: (v: unknown, i: number) => void,
    ...fns: Function[]
  ) => void
  return (source) => fn(source as Iterable<unknown>, sink, ...argValues)
}

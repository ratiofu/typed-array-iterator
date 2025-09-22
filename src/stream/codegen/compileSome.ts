import type { FilterFn, Op } from '../types'
import { buildOpsUnrolled } from './shared'

/**
 * Compile a specialized `some` terminal.
 *
 * Relationship to overall compilation:
 * - Inlines the fused map/filter pipeline produced by buildOpsUnrolled().
 * - After each element passes the pipeline, applies terminalPredicate and early-returns true.
 * - Selects array-indexed or iterable loop based on isArrayLikeSource.
 */
export function compileSome(
  isArrayLikeSource: boolean,
  ops: readonly Op[],
  terminalPredicate: FilterFn
): (source: Iterable<unknown> | ArrayLike<unknown>) => boolean {
  const { argNames, argValues, lines } = buildOpsUnrolled(ops)

  if (isArrayLikeSource) {
    const srcArgs = ['data', 'terminalPredicate', ...argNames]
    const body = `
const dataLength = data.length
let logicalIndex = 0
let emittedIndex = 0
for (let i = 0; i < dataLength; i++) {
  let currentValue = data[i]
  const index = logicalIndex++
  ${lines.map((l) => `  ${l}`).join('\n')}
  if (terminalPredicate(currentValue, emittedIndex++)) { return true }
}
return false
    `
    const fn = new Function(...srcArgs, body) as (
      data: ArrayLike<unknown>,
      terminalPredicate: (v: unknown, i: number) => boolean,
      ...fns: Function[]
    ) => boolean
    return (source) => fn(source as ArrayLike<unknown>, terminalPredicate, ...argValues)
  }

  const srcArgs = ['iterable', 'terminalPredicate', ...argNames]
  const body = `
let logicalIndex = 0
let emittedIndex = 0
for (const currentValueRaw of iterable) {
  let currentValue = currentValueRaw
  const index = logicalIndex++
  ${lines.map((l) => `  ${l}`).join('\n')}
  if (terminalPredicate(currentValue, emittedIndex++)) { return true }
}
return false
  `
  const fn = new Function(...srcArgs, body) as (
    iterable: Iterable<unknown>,
    terminalPredicate: (v: unknown, i: number) => boolean,
    ...fns: Function[]
  ) => boolean
  return (source) => fn(source as Iterable<unknown>, terminalPredicate, ...argValues)
}

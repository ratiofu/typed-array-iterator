import type { FilterFn, Op } from '../types'
import { buildOpsUnrolled } from './shared'

/**
 * Compile a specialized `find` terminal.
 *
 * Relationship to overall compilation:
 * - Reuses the fused pipeline from buildOpsUnrolled() and returns the first matching value.
 * - Early-exits the loop once terminalPredicate matches, preserving iterator.return() behavior
 *   on the iterable path.
 */
export function compileFind(
  isArrayLikeSource: boolean,
  ops: readonly Op[],
  terminalPredicate: FilterFn
): (source: Iterable<unknown> | ArrayLike<unknown>) => unknown | undefined {
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
  if (terminalPredicate(currentValue, emittedIndex++)) { return currentValue }
}
return undefined
    `
    const fn = new Function(...srcArgs, body) as (
      data: ArrayLike<unknown>,
      terminalPredicate: (v: unknown, i: number) => boolean,
      ...fns: Function[]
    ) => unknown | undefined
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
  if (terminalPredicate(currentValue, emittedIndex++)) { return currentValue }
}
return undefined
  `
  const fn = new Function(...srcArgs, body) as (
    iterable: Iterable<unknown>,
    terminalPredicate: (v: unknown, i: number) => boolean,
    ...fns: Function[]
  ) => unknown | undefined
  return (source) => fn(source as Iterable<unknown>, terminalPredicate, ...argValues)
}

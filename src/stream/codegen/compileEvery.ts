import type { FilterFn, Op } from '../types'
import { buildOpsUnrolled, emitArrayLoop, emitIterableLoop } from './shared'

/**
 * Compile a specialized `every` terminal.
 *
 * Relationship to overall compilation:
 * - Embeds the fused map/filter pipeline via buildOpsUnrolled().
 * - Applies `terminalPredicate` on each emitted element and early-returns false on first failure.
 * - Uses array-indexed or iterable loop depending on `isArrayLikeSource`.
 */
export function compileEvery(
  isArrayLikeSource: boolean,
  ops: readonly Op[],
  terminalPredicate: FilterFn
): (source: Iterable<unknown> | ArrayLike<unknown>) => boolean {
  const { argNames, argValues, lines } = buildOpsUnrolled(ops)

  if (isArrayLikeSource) {
    const srcArgs = ['data', 'terminalPredicate', ...argNames]
    const body = `
${emitArrayLoop(lines, '  if (!terminalPredicate(currentValue, emittedIndex++)) { return false }')}
return true
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
${emitIterableLoop(lines, '  if (!terminalPredicate(currentValue, emittedIndex++)) { return false }')}
return true
`
  const fn = new Function(...srcArgs, body) as (
    iterable: Iterable<unknown>,
    terminalPredicate: (v: unknown, i: number) => boolean,
    ...fns: Function[]
  ) => boolean
  return (source) => fn(source as Iterable<unknown>, terminalPredicate, ...argValues)
}

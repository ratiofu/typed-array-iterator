import type { FilterFn, Op } from '../types'
import { buildOpsUnrolled, emitArrayLoop, emitIterableLoop } from './shared'

const TERMINAL = '  if (!terminalPredicate(currentValue, emittedIndex++)) { return false }'

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
  const srcArgs = ['data', 'terminalPredicate', ...argNames]
  const body = `
${isArrayLikeSource ? emitArrayLoop(lines, TERMINAL) : emitIterableLoop(lines, TERMINAL)}
return true
`
  const fn = new Function(...srcArgs, body)
  return (source) => fn(source, terminalPredicate, ...argValues)
}

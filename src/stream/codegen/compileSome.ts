import type { FilterFn, Op } from '../types'
import { buildOpsUnrolled, emitArrayLoop, emitIterableLoop } from './shared'

const TERMINAL = '  if (terminalPredicate(currentValue, emittedIndex++)) { return true }'

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

  const srcArgs = ['data', 'terminalPredicate', ...argNames]
  const body = `
${isArrayLikeSource ? emitArrayLoop(lines, TERMINAL) : emitIterableLoop(lines, TERMINAL)}
return false
`
  const fn = new Function(...srcArgs, body)
  return (source) => fn(source, terminalPredicate, ...argValues)
}

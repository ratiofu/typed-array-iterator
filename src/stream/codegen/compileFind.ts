import type { FilterFn, Op } from '../types'
import { buildOpsUnrolled, emitArrayLoop, emitIterableLoop } from './shared'

const TERMINAL = '  if (terminalPredicate(currentValue, emittedIndex++)) { return currentValue }'

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

  const srcArgs = ['data', 'terminalPredicate', ...argNames]
  const body = `
${isArrayLikeSource ? emitArrayLoop(lines, TERMINAL) : emitIterableLoop(lines, TERMINAL)}
return undefined
`
  const fn = new Function(...srcArgs, body)
  return (source) => fn(source, terminalPredicate, ...argValues)
}

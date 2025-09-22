import type { Op } from '../types'
import { buildOpsUnrolled, emitArrayLoop, emitIterableLoop } from './shared'

const TERMINAL = '  sink(currentValue, emittedIndex++)'

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

  const srcArgs = ['data', 'sink', ...argNames]
  const body = `
${isArrayLikeSource ? emitArrayLoop(lines, TERMINAL) : emitIterableLoop(lines, TERMINAL)}
`
  const fn = new Function(...srcArgs, body)
  return (source) => fn(source, sink, ...argValues)
}

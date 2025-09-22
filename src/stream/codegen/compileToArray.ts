import type { Op } from '../types'
import { buildOpsUnrolled, emitArrayLoop, emitIterableLoop } from './shared'

/**
 * Compile a specialized `toArray` terminal that materializes results.
 *
 * Relationship to overall compilation:
 * - Uses buildOpsUnrolled() to inline the fused map/filter pipeline before pushing results.
 * - Picks loop form based on isArrayLikeSource (indexed vs for..of).
 * - Returns a zero-alloc inner loop aside from the output array.
 */
export function compileToArray(
  isArrayLikeSource: boolean,
  ops: readonly Op[]
): (source: Iterable<unknown> | ArrayLike<unknown>) => unknown[] {
  const { argNames, argValues, lines } = buildOpsUnrolled(ops)

  if (isArrayLikeSource) {
    const srcArgs = ['data', ...argNames]
    const body = `
const result = []
${emitArrayLoop(lines, '  result.push(currentValue)\n  emittedIndex++')}
return result
`
    const fn = new Function(...srcArgs, body) as (
      data: ArrayLike<unknown>,
      ...fns: Function[]
    ) => unknown[]
    return (source) => fn(source as ArrayLike<unknown>, ...argValues)
  }

  const srcArgs = ['iterable', ...argNames]
  const body = `
const result = []
${emitIterableLoop(lines, '  result.push(currentValue)\n  emittedIndex++')}
return result
`
  const fn = new Function(...srcArgs, body) as (
    iterable: Iterable<unknown>,
    ...fns: Function[]
  ) => unknown[]
  return (source) => fn(source as Iterable<unknown>, ...argValues)
}

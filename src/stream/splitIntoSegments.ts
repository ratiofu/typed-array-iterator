import type { Op } from './types'

/**
 * Splits a list of operations into segments separated by 'flatten' operations.
 * Each segment can be applied in a linear fashion without flattening.
 */
export function splitIntoSegments(ops: readonly Op[]): readonly Op[][] {
  const segments: Op[][] = [[]]
  for (const op of ops) {
    if (op.kind === 'flatten') {
      segments.push([])
    } else {
      segments[segments.length - 1]?.push(op)
    }
  }
  return segments
}

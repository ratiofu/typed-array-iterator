import { type FilterOp, type MapOp, type Op, type ResultSkip, SKIP } from './types'

/**
 * This function applies a series of operations to an initial value in-place,
 * but does not support `flatten`-like operations.
 */
export function applyOpsInPlace(
  ops: readonly Op[],
  initial: unknown,
  logicalIndex: number
): unknown | ResultSkip {
  let value = initial
  const { length } = ops
  for (let index = 0; index < length; index++) {
    const op = ops[index]
    switch (op?.kind) {
      case 'map':
        value = (op as MapOp).fn(value, logicalIndex)
        break
      case 'filter':
        if (!(op as FilterOp).predicate(value, logicalIndex)) {
          return SKIP
        }
        break
      default:
        throw new Error(`unsupported operation: ${op?.kind}`)
    }
  }
  return value
}

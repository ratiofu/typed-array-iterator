import { applyOpsInPlace } from './applyOpsInPlace'
import { DONE, type Op, SKIP } from './types'

/**
 * Builds a custom iterator that applies the given operations to each value
 * from the input iterator. `flatten`-like operations are not supported.
 */
export function mapFilterIterator(input: Iterator<unknown>, ops: readonly Op[]): Iterator<unknown> {
  let logicalIndex = 0
  return {
    next(): IteratorResult<unknown> {
      while (true) {
        const next = input.next()
        if (next.done) {
          return DONE
        }
        const post = applyOpsInPlace(ops, next.value, logicalIndex++)
        if (post !== SKIP) {
          return { done: false, value: post }
        }
      }
    },
    return(): IteratorResult<unknown> {
      try {
        input.return?.()
      } catch {
        // ignore
      }
      return DONE
    },
  }
}

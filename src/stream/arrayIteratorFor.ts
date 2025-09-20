import { applyOpsInPlace } from './applyOpsInPlace'
import { DONE, type Op, SKIP } from './types'

/**
 * Builds a custom iterator for the given array, applying the given operations during iteration.
 * `flatten`-like operations are not supported.
 */
export function arrayIteratorFor<T>(array: ArrayLike<unknown>, operations: readonly Op[]) {
  let index = 0
  let logicalIndex = 0 // index passed to operators (pre-filter)
  let done = false
  return {
    next(): IteratorResult<T> {
      if (done) {
        return DONE
      }
      const { length } = array
      while (index < length) {
        // TODO: index and logicalIndex are both always incremented together. why?
        const post = applyOpsInPlace(operations, array[index++], logicalIndex++)
        if (post !== SKIP) {
          return { done: false, value: post as T }
        }
      }
      done = true
      return DONE
    },
    return(): IteratorResult<T> {
      done = true
      return DONE
    },
    [Symbol.iterator](): IterableIterator<T> {
      return this
    },
  }
}

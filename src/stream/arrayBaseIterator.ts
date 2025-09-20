import { DONE } from './types'

// TODO: is this the same as iterableBaseIterator?
// TODO: why not just use the array's own iterator?
export function arrayBaseIterator(array: ArrayLike<unknown>): Iterator<unknown> {
  let index = 0
  let done = false
  return {
    next(): IteratorResult<unknown> {
      if (done) {
        return DONE
      }
      if (index < array.length) {
        return { done: false, value: array[index++] }
      }
      done = true
      return DONE
    },
    return(): IteratorResult<unknown> {
      done = true
      return DONE
    },
  }
}

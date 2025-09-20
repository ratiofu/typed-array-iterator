import { DONE } from './types'

// TODO: why is this wrapping even necessary?
// TODO: is this the same as iterableBaseIterator?
export function wrapAsIterableIterator<T>(inner: Iterator<unknown>): IterableIterator<T> {
  return {
    next(): IteratorResult<T> {
      return inner.next() as IteratorResult<T>
    },
    return(): IteratorResult<T> {
      const returnResult = inner.return?.()
      if (returnResult && typeof returnResult === 'object') {
        return returnResult as IteratorResult<T>
      }
      return DONE
    },
    // TODO: shouldn't this return inner?
    [Symbol.iterator](): IterableIterator<T> {
      return this
    },
  }
}

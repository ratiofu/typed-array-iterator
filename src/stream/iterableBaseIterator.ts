import { DONE } from './types'

// TODO: is this the same as wrapAsIterableIterator?
export function iterableBaseIterator(iterable: Iterable<unknown>): Iterator<unknown> {
  const it = iterable[Symbol.iterator]()
  let done = false
  return {
    next(): IteratorResult<unknown> {
      if (done) {
        return DONE
      }
      const next = it.next()
      if (next.done) {
        done = true
        return DONE
      }
      return next
    },
    return(): IteratorResult<unknown> {
      done = true
      try {
        ;(it as { return?: () => IteratorResult<unknown> }).return?.()
      } catch {
        // ignore
      }
      return DONE
    },
  }
}

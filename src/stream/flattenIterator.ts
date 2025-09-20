import { DONE, type ResultDone, type ResultSkip, SKIP } from './types'

export type IteratorPullResult = ResultSkip | ResultDone | Iterator<unknown>

export function flattenIterator(input: Iterator<unknown>): Iterator<unknown> {
  let sub: Iterator<unknown> | null = null
  return {
    next(): IteratorResult<unknown> {
      // Phase 1: ensure we have a sub-iterator (or detect completion)
      while (sub === null) {
        const next = pullIteratorFromInput(input)
        switch (next) {
          case DONE:
            return DONE
          case SKIP:
            continue
          default:
            sub = next as Iterator<unknown>
        }
      }
      // Phase 2: drain current sub-iterator once
      const next = sub.next()
      if (!next.done) {
        return next
      }
      sub = null
      // Tail repeat
      return this.next()
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

function getIteratorIfIterable(value: unknown): Iterator<unknown> | null {
  const maybe = value as { [Symbol.iterator]?: unknown } | null | undefined
  const candidate = maybe?.[Symbol.iterator]
  return typeof candidate === 'function' ? candidate.apply(maybe) : null
}

function pullIteratorFromInput(input: Iterator<unknown>): IteratorPullResult {
  const next = input.next()
  if (next.done) {
    return DONE
  }
  const it = getIteratorIfIterable(next.value)
  // TODO: doesn't SKIP here drop the value unintentionally if it's not an iterator?
  return it ?? SKIP
}

import { createFusedIterator } from './stream/createFusedIterator'
import { DONE, type FilterOp, FLATTEN_OP, type MapOp, type Op } from './stream/types'

/**
 * Memory-efficient, single-use, lazy stream for iterables.
 *
 * Notes:
 * - Single-use: once iterated by any terminal or for...of, it cannot be used again
 * - Manual iterator-based pipeline: map/filter are fused; no intermediate arrays allocated
 */
export class Stream<T> implements IteratorObject<T, BuiltinIteratorReturn, unknown>, Iterable<T> {
  readonly #source: Iterable<unknown>
  readonly #ops: readonly Op[]
  #iter: IterableIterator<T> | null = null

  constructor(source: Iterable<T> | Iterable<unknown>, ops?: readonly Op[]) {
    this.#source = source as Iterable<unknown>
    this.#ops = ops ?? []
  }

  #used = false

  // Ensures the stream is only consumed once by terminals
  #ensureUsedOnlyOnce(): void {
    if (this.#used || this.#iter) {
      throw new Error('Stream already consumed')
    }
    this.#used = true
  }

  map<U>(fn: (v: T, i: number) => U): Stream<U> {
    const op: MapOp = { kind: 'map', fn: fn as unknown as (v: unknown, i: number) => unknown }
    return new Stream<U>(this.#source, [...this.#ops, op])
  }

  filter<S extends T>(predicate: (value: T, i: number) => value is S): Stream<S>
  filter(predicate: (value: T, index: number) => boolean): Stream<T>
  filter<S extends T>(predicate: (value: T, index: number) => boolean): Stream<S | T> {
    const op: FilterOp = {
      kind: 'filter',
      predicate: predicate as unknown as (v: unknown, i: number) => boolean,
    }
    return new Stream<S | T>(this.#source, [...this.#ops, op])
  }

  // optional iterator helpers to satisfy IteratorObject typing
  // Minimal semantics: drop implemented as a filter; take implemented as a filter (no early stop)
  drop(n: number): Stream<T> {
    let remaining = n
    return this.filter(() => remaining-- <= 0)
  }

  take(n: number): Stream<T> {
    let remaining = n
    return this.filter(() => remaining-- > 0)
  }

  flatMap<U>(f: (v: T, i: number) => Iterable<U>): Stream<U> {
    // Implemented as map(f) followed by a flatten operator; supports multiple occurrences
    const mapOp: MapOp = {
      kind: 'map',
      fn: f as unknown as (v: unknown, i: number) => Iterable<unknown>,
    }
    return new Stream<U>(this.#source, [...this.#ops, mapOp, FLATTEN_OP])
  }

  flatten<U extends T extends Array<infer I> ? I : never>(): Stream<U> {
    return new Stream<U>(this.#source, [...this.#ops, FLATTEN_OP])
  }

  // Terminal: materialize to array
  toArray(): T[] {
    this.#ensureUsedOnlyOnce()
    const out: T[] = []
    for (const v of this) {
      out.push(v)
    }
    return out
  }

  // Terminal: forEach side effects
  forEach(fn: (v: T, i: number) => void): void {
    this.#ensureUsedOnlyOnce()
    let i = 0
    for (const v of this) {
      fn(v, i++)
    }
  }

  // Terminal: reduce (Iterator Helpers signature)
  reduce<U = T>(reducer: (previous: U, current: T, index: number) => U, initialValue?: U): U {
    this.#ensureUsedOnlyOnce()
    let index = 0
    let accumulated: U | undefined = initialValue
    let started = false

    if (accumulated !== undefined) {
      started = true
    }

    for (const v of this) {
      if (started) {
        accumulated = reducer(accumulated as U, v, index)
      } else {
        accumulated = v as unknown as U
        started = true
      }
      index++
    }

    if (!started) {
      throw new TypeError('Reduce of empty stream with no initial value')
    }

    return accumulated as U // protection against empty stream is above
  }

  // Terminal helpers
  some(predicate: (v: T, i: number) => boolean): boolean {
    this.#ensureUsedOnlyOnce()
    let i = 0
    for (const v of this) {
      if (predicate(v, i++)) {
        return true
      }
    }
    return false
  }

  every(predicate: (v: T, i: number) => boolean): boolean {
    this.#ensureUsedOnlyOnce()
    let i = 0
    for (const v of this) {
      if (!predicate(v, i++)) {
        return false
      }
    }
    return true
  }

  find(predicate: (v: T, i: number) => boolean): T | undefined {
    this.#ensureUsedOnlyOnce()
    let i = 0
    for (const v of this) {
      if (predicate(v, i++)) {
        return v
      }
    }
    return undefined
  }

  get [Symbol.toStringTag](): string {
    return `Stream(${
      this.#source?.constructor?.name ?? this.#source?.toString() ?? 'unknown'
    }, ${this.#ops.map((op) => op.kind).join('->')})`
  }

  [Symbol.dispose](): void {
    try {
      this.return?.()
    } catch {
      // ignore
    }
  }

  // Single-use iterator creation
  [Symbol.iterator](): this {
    this.#ensureIterator()
    return this
  }

  next(...args: [] | [unknown]): IteratorResult<T, BuiltinIteratorReturn> {
    const [arg] = args
    return this.#ensureIterator().next(arg)
  }

  return(value?: BuiltinIteratorReturn): IteratorResult<T, BuiltinIteratorReturn> {
    const iterator = this.#ensureIterator()
    const returnValue = iterator.return?.(value)
    if (returnValue && typeof returnValue === 'object') {
      return returnValue
    }
    return DONE
  }

  throw(error?: unknown): IteratorResult<T, BuiltinIteratorReturn> {
    const thrown = this.#ensureIterator().throw?.(error)
    if (thrown && typeof thrown === 'object') {
      return thrown
    }
    throw error
  }

  #ensureIterator() {
    let iterator = this.#iter
    if (!iterator) {
      iterator = createFusedIterator<T>(this.#source, this.#ops)
      this.#iter = iterator
    }
    return iterator
  }
}

export function stream<T>(source: Iterable<T>): Stream<T> {
  return new Stream<T>(source)
}

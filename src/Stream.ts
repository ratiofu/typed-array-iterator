import { emptyArray } from './lib/empty'
import { compileEvery } from './stream/codegen/compileEvery'
import { compileFind } from './stream/codegen/compileFind'
import { compileForEach } from './stream/codegen/compileForEach'
import { compileReduce } from './stream/codegen/compileReduce'
import { compileSome } from './stream/codegen/compileSome'
import { compileToArray } from './stream/codegen/compileToArray'
import { isArrayLike } from './stream/isArrayLike'
import type { FilterFn, FilterOp, MapFn, MapOp, Op } from './stream/types'

/**
 * Single-use, lazy pipeline builder for iterables (Java-style semantics).
 *
 * Notes:
 * - Stream is NOT iterable; you must call a terminal (e.g. toArray, forEach, reduce)
 * - Single-use: once any terminal is called, the stream cannot be used again
 */
export class Stream<T> {
  readonly #source: Iterable<T> | ArrayLike<T>
  readonly #ops: readonly Op[]

  #isArrayLike: boolean | null = null

  constructor(source: Iterable<T> | ArrayLike<T>, ops?: readonly Op[]) {
    this.#source = source
    this.#ops = ops ?? emptyArray<Op>()
  }

  get #arrayLike() {
    let arrayLike = this.#isArrayLike
    if (arrayLike === null) {
      arrayLike = isArrayLike(this.#source)
      this.#isArrayLike = arrayLike
    }
    return arrayLike
  }

  /**
   * Transform each element with `fn`.
   * - Lazy and single-use: returns a new Stream with the op appended.
   * @param fn mapping function `(value, index) => nextValue`
   * @returns a new Stream of U
   */

  map<U>(fn: (value: T, index: number) => U): Stream<U> {
    const op: MapOp = { kind: 'map', fn: fn as MapFn }
    // this type hack is necessary and intentional ↓
    return new Stream<U>(this.#source as Iterable<U>, [...this.#ops, op])
  }

  /**
   * Filter elements with a predicate (supports type guards).
   * - Lazy and single-use: returns a new Stream with the op appended.
   * @param predicate `(value, index) => boolean` or type guard
   * @returns a new Stream narrowed/filtered by the predicate
   */

  filter<S extends T>(predicate: (value: T, index: number) => value is S): Stream<S>
  filter(predicate: (value: T, index: number) => boolean): Stream<T>
  filter<S extends T>(predicate: (value: T, index: number) => boolean): Stream<S | T> {
    const op: FilterOp = {
      kind: 'filter',
      fn: predicate as FilterFn,
    }

    return new Stream<S | T>(this.#source, [...this.#ops, op])
  }

  // Convenience helpers implemented as filters (no early-stop semantics)
  // drop: skip the first n elements; take: keep only the first n elements
  /**
   * Skip the first `n` elements.
   * Implemented as a filter without early-stop semantics.
   */
  drop(n: number): Stream<T> {
    let remaining = n
    return this.filter(() => remaining-- <= 0)
  }

  /**
   * Keep only the first `n` elements.
   * Implemented as a filter without early-stop semantics.
   */
  take(n: number): Stream<T> {
    let remaining = n
    return this.filter(() => remaining-- > 0)
  }

  /**
   * Terminal: materialize the pipeline into an array.
   * Compiles and runs a specialized toArray for this stream.
   */
  toArray(): T[] {
    const run = compileToArray(this.#arrayLike, this.#ops)
    return run(this.#source) as T[]
  }

  /**
   * Terminal: forEach side effects.
   * Executes a compiled forEach with the provided sink.
   */
  forEach(fn: (value: T, index: number) => void): void {
    const run = compileForEach(
      this.#arrayLike,
      this.#ops,
      fn as unknown as (value: unknown, index: number) => void
    )
    run(this.#source)
  }

  /**
   * Terminal: reduce over the emitted elements.
   * If `initialValue` is omitted, the first emitted element is used as the seed.
   */
  reduce<U = T>(reducer: (previous: U, current: T, index: number) => U, initialValue?: U): U {
    const run = compileReduce(
      this.#arrayLike,
      this.#ops,
      reducer as unknown as (accumulator: unknown, value: unknown, index: number) => unknown,
      initialValue !== undefined,
      initialValue as unknown
    )
    return run(this.#source) as U
  }

  // Terminal helpers
  /**
   * Terminal: returns true if any element satisfies the predicate.
   */
  some(predicate: (value: T, index: number) => boolean): boolean {
    const run = compileSome(this.#arrayLike, this.#ops, predicate as FilterFn)
    return run(this.#source)
  }

  /**
   * Terminal: returns true if all elements satisfy the predicate.
   */
  every(predicate: (value: T, index: number) => boolean): boolean {
    const run = compileEvery(this.#arrayLike, this.#ops, predicate as FilterFn)
    return run(this.#source)
  }

  /**
   * Terminal: returns the first element satisfying the predicate, or undefined.
   */
  find(predicate: (value: T, index: number) => boolean): T | undefined {
    const run = compileFind(this.#arrayLike, this.#ops, predicate as FilterFn)
    return run(this.#source) as T | undefined
  }

  /**
   * Debug/diagnostic label describing the source kind and ops chain.
   */
  get [Symbol.toStringTag](): string {
    return `Stream(${
      this.#source?.constructor?.name ?? this.#source?.toString() ?? 'unknown'
    }, ${this.#ops.map((op) => op.kind).join('->')})`
  }
}

/**
 * Helper to create a Stream from any Iterable.
 */
export function stream<T>(source: Iterable<T>): Stream<T> {
  return new Stream<T>(source)
}

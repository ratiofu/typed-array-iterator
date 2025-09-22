import { isArrayLike } from './stream/isArrayLike'
import { buildOpsUnrolled, emitArrayLoop, emitIterableLoop, emptyArray } from './stream/shared'
import type { FilterFn, FilterOp, MapFn, MapOp, Op } from './stream/types'

// Terminal snippets, with index call supported for operations
const TERMINAL_TO_ARRAY = 'result[emittedIndex++] = currentValue'
const TERMINAL_FOR_EACH = 'sink(currentValue, emittedIndex++)'
const TERMINAL_SOME = 'if (terminalPredicate(currentValue, emittedIndex++)) { return true }'
const TERMINAL_EVERY = 'if (!terminalPredicate(currentValue, emittedIndex++)) { return false }'
const TERMINAL_FIND = 'if (terminalPredicate(currentValue, emittedIndex++)) { return currentValue }'
const TERMINAL_REDUCE = `
if (started) {
  accumulator = reducer(accumulator, currentValue, emittedIndex++)
} else {
  accumulator = currentValue
  started = true
  emittedIndex++
}
`

// Terminal snippets, without index support
const TERMINAL_FOR_EACH_NO_INDEX = 'sink(currentValue)'
const TERMINAL_SOME_NO_INDEX = 'if (terminalPredicate(currentValue)) { return true }'
const TERMINAL_EVERY_NO_INDEX = 'if (!terminalPredicate(currentValue)) { return false }'
const TERMINAL_FIND_NO_INDEX = 'if (terminalPredicate(currentValue)) { return currentValue }'
const TERMINAL_REDUCE_NO_INDEX = `
if (started) {
  accumulator = reducer(accumulator, currentValue)
} else {
  accumulator = currentValue
  started = true
}
`

/**
 * Lazy, compiled pipeline builder for iterables. Achieves similar performance as
 * manual loops while providing a functional, declarative API.
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

  // ---- Terminals ----

  /**
   * Terminal: materialize the pipeline into an array.
   * Compiles and runs a specialized toArray for this stream.
   */
  toArray(): T[] {
    const { argNames, argValues, lines } = buildOpsUnrolled(this.#ops)
    const hasFilter = this.#ops.some((op) => op.kind === 'filter')
    argNames.unshift('data')
    return new Function(
      ...argNames,
      `
${
  this.#arrayLike
    ? hasFilter
      ? 'const result = new Array(data.length >>> 1)'
      : 'const result = new Array(data.length)'
    : 'const result = []'
}
${this.#arrayLike ? emitArrayLoop(lines, TERMINAL_TO_ARRAY) : emitIterableLoop(lines, TERMINAL_TO_ARRAY)}
result.length = emittedIndex
return result
      `
    )(this.#source, ...argValues)
  }

  /**
   * Terminal: forEach side effects.
   * Executes a compiled forEach with the provided sink.
   */
  forEach(fn: (value: T, index: number) => void): void {
    const { argNames, argValues, lines } = buildOpsUnrolled(this.#ops)
    const terminal = fn.length >= 2 ? TERMINAL_FOR_EACH : TERMINAL_FOR_EACH_NO_INDEX
    argNames.unshift('data', 'sink')
    new Function(
      ...argNames,
      this.#arrayLike ? emitArrayLoop(lines, terminal) : emitIterableLoop(lines, terminal)
    )(this.#source, fn, ...argValues)
  }

  /**
   * Terminal: reduce over the emitted elements.
   * If `initialValue` is omitted, the first emitted element is used as the seed.
   */
  reduce<U = T>(reducer: (previous: U, current: T, index: number) => U, initialValue?: U): U {
    const { argNames, argValues, lines } = buildOpsUnrolled(this.#ops)
    const terminal = reducer.length >= 3 ? TERMINAL_REDUCE : TERMINAL_REDUCE_NO_INDEX
    argNames.unshift('data', 'reducer', 'hasInitial', 'initialValue')
    return new Function(
      ...argNames,
      `
let started = hasInitial
let accumulator = initialValue
${this.#arrayLike ? emitArrayLoop(lines, terminal) : emitIterableLoop(lines, terminal)}
if (!started) { throw new TypeError("Reduce of empty stream with no initial value") }
return accumulator
`
    )(this.#source, reducer, initialValue !== undefined, initialValue, ...argValues) as U
  }

  /**
   * Terminal: returns true if any element satisfies the predicate.
   */
  some(predicate: (value: T, index: number) => boolean): boolean {
    const { argNames, argValues, lines } = buildOpsUnrolled(this.#ops)
    const terminal = predicate.length >= 2 ? TERMINAL_SOME : TERMINAL_SOME_NO_INDEX
    argNames.unshift('data', 'terminalPredicate')
    return new Function(
      ...argNames,
      `
${this.#arrayLike ? emitArrayLoop(lines, terminal) : emitIterableLoop(lines, terminal)}
return false
      `
    )(this.#source, predicate, ...argValues)
  }

  /**
   * Terminal: returns true if all elements satisfy the predicate.
   */
  every(predicate: (value: T, index: number) => boolean): boolean {
    const { argNames, argValues, lines } = buildOpsUnrolled(this.#ops)
    const terminal = predicate.length >= 2 ? TERMINAL_EVERY : TERMINAL_EVERY_NO_INDEX
    argNames.unshift('data', 'terminalPredicate')
    return new Function(
      ...argNames,
      `
${this.#arrayLike ? emitArrayLoop(lines, terminal) : emitIterableLoop(lines, terminal)}
return true
      `
    )(this.#source, predicate, ...argValues)
  }

  /**
   * Terminal: returns the first element satisfying the predicate, or undefined.
   */
  find(predicate: (value: T, index: number) => boolean): T | undefined {
    const { argNames, argValues, lines } = buildOpsUnrolled(this.#ops)
    const terminal = predicate.length >= 2 ? TERMINAL_FIND : TERMINAL_FIND_NO_INDEX
    argNames.unshift('data', 'terminalPredicate')
    return new Function(
      ...argNames,
      `
${this.#arrayLike ? emitArrayLoop(lines, terminal) : emitIterableLoop(lines, terminal)}
return undefined
      `
    )(this.#source, predicate, ...argValues)
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

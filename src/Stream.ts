import { isArrayLike } from './stream/isArrayLike'
import { buildOpsUnrolled, emitArrayLoop, emitIterableLoop, emptyArray } from './stream/shared'
import type { FieldsParam, FilterFn, FilterOp, MapFn, MapOp, Op } from './stream/types'

// Private: valid JS identifier for dot-notation property access
const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

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
 * manual loops while providing a functional, declarative API. On v8, this approach
 * is consistently faster than array methods.
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
   * Specialized text filter over one or more string fields.
   * - Splits `query` on whitespace; removes empty tokens.
   * - If no token has length > 2, the filter rejects all values.
   * - Builds case-insensitive regexes per token:
   *   - token.length < 4 => word-start match ("\\btoken")
   *   - token.length >= 4 => contains match ("token")
   * - Matching rule: each token must match at least one of the provided fields; tokens may match across different fields.
   * - Typing: when T has a string index signature (string extends keyof T), `fields` falls back to `string[]`.
   */
  filterText(query: string, ...fields: FieldsParam<T>): Stream<T> {
    const tokens = query.split(/\s+/).filter((t) => t.length > 0)
    if (fields.length === 0) {
      // No fields to search -> reject all
      return this.filter(() => false)
    }
    if (!tokens.some((t) => t.length > 2)) {
      // No token long enough -> reject all per spec
      return this.filter(() => false)
    }
    // Sort tokens by length (desc) to increase selectivity (in-place sort to avoid extra allocation)
    tokens.sort((a, b) => b.length - a.length)
    const regexes = tokens.map((t) => new RegExp((t.length < 4 ? '^' : '') + escapeRegExp(t), 'i'))

    // Build field accessors using dot notation when safe, otherwise bracket notation
    const fieldVarNames = fields.map((_f, i) => `v${i + 1}`)
    const fieldAccessors = fields.map((f) => {
      const key = String(f)
      return IDENTIFIER_RE.test(key) ? `value.${key}` : `value[${JSON.stringify(key)}]`
    })

    // Build body using an array of lines and join at the end to minimize intermediate strings
    const lines: string[] = []
    for (let i = 0; i < fieldVarNames.length; i++) {
      const v = fieldVarNames[i]
      const acc = fieldAccessors[i]
      lines.push(`let ${v} = ${acc}`)
      lines.push(`if (typeof ${v} !== 'string') { ${v} = '' }`)
    }

    if (regexes.length === 1) {
      // Linear structure for single token
      const r0 = 'rs[0]'
      for (const v of fieldVarNames) {
        lines.push(`if (${r0}.test(${v})) { return true }`)
      }
      lines.push('return false')
    } else if (regexes.length === 2) {
      // First token must match any field
      lines.push(
        `if (!(${fieldVarNames.map((v) => `rs[0].test(${v})`).join(' || ')})) { return false }`
      )
      // Second token must match any field
      lines.push(
        `if (!(${fieldVarNames.map((v) => `rs[1].test(${v})`).join(' || ')})) { return false }`
      )
      lines.push('return true')
    } else {
      // General case: each token must match at least one field
      for (let i = 0; i < regexes.length; i++) {
        lines.push(
          `if (!(${fieldVarNames.map((v) => `rs[${i}].test(${v})`).join(' || ')})) { return false }`
        )
      }
      lines.push('return true')
    }

    const body = lines.join('\n')
    const compiled = new Function('value', 'rs', body)
    return this.filter((value) => compiled(value, regexes))
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
    const { argNames, argValues, lines, opsNeedIndex } = buildOpsUnrolled(this.#ops)
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
${this.#arrayLike ? emitArrayLoop(lines, TERMINAL_TO_ARRAY) : emitIterableLoop(lines, TERMINAL_TO_ARRAY, opsNeedIndex)}
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
    const { argNames, argValues, lines, opsNeedIndex } = buildOpsUnrolled(this.#ops)
    const terminal = fn.length >= 2 ? TERMINAL_FOR_EACH : TERMINAL_FOR_EACH_NO_INDEX
    argNames.unshift('data', 'sink')
    new Function(
      ...argNames,
      this.#arrayLike
        ? emitArrayLoop(lines, terminal)
        : emitIterableLoop(lines, terminal, opsNeedIndex || fn.length >= 2)
    )(this.#source, fn, ...argValues)
  }

  /**
   * Terminal: reduce over the emitted elements.
   * If `initialValue` is omitted, the first emitted element is used as the seed.
   */
  reduce<U = T>(reducer: (previous: U, current: T, index: number) => U, initialValue?: U): U {
    const { argNames, argValues, lines, opsNeedIndex } = buildOpsUnrolled(this.#ops)
    const terminal = reducer.length >= 3 ? TERMINAL_REDUCE : TERMINAL_REDUCE_NO_INDEX
    argNames.unshift('data', 'reducer', 'hasInitial', 'initialValue')
    return new Function(
      ...argNames,
      `
let started = hasInitial
let accumulator = initialValue
${
  this.#arrayLike
    ? emitArrayLoop(lines, terminal)
    : emitIterableLoop(lines, terminal, opsNeedIndex || reducer.length >= 3)
}
if (!started) { throw new TypeError("Reduce of empty stream with no initial value") }
return accumulator
`
    )(this.#source, reducer, initialValue !== undefined, initialValue, ...argValues) as U
  }

  /**
   * Terminal: returns true if any element satisfies the predicate.
   */
  some(predicate: (value: T, index: number) => boolean): boolean {
    const { argNames, argValues, lines, opsNeedIndex } = buildOpsUnrolled(this.#ops)
    const terminal = predicate.length >= 2 ? TERMINAL_SOME : TERMINAL_SOME_NO_INDEX
    argNames.unshift('data', 'terminalPredicate')
    return new Function(
      ...argNames,
      `
${
  this.#arrayLike
    ? emitArrayLoop(lines, terminal)
    : emitIterableLoop(lines, terminal, opsNeedIndex || predicate.length >= 2)
}
return false
      `
    )(this.#source, predicate, ...argValues)
  }

  /**
   * Terminal: returns true if all elements satisfy the predicate.
   */
  every(predicate: (value: T, index: number) => boolean): boolean {
    const { argNames, argValues, lines, opsNeedIndex } = buildOpsUnrolled(this.#ops)
    const terminal = predicate.length >= 2 ? TERMINAL_EVERY : TERMINAL_EVERY_NO_INDEX
    argNames.unshift('data', 'terminalPredicate')
    return new Function(
      ...argNames,
      `
${
  this.#arrayLike
    ? emitArrayLoop(lines, terminal)
    : emitIterableLoop(lines, terminal, opsNeedIndex || predicate.length >= 2)
}
return true
      `
    )(this.#source, predicate, ...argValues)
  }

  /**
   * Terminal: returns the first element satisfying the predicate, or undefined.
   */
  find(predicate: (value: T, index: number) => boolean): T | undefined {
    const { argNames, argValues, lines, opsNeedIndex } = buildOpsUnrolled(this.#ops)
    const terminal = predicate.length >= 2 ? TERMINAL_FIND : TERMINAL_FIND_NO_INDEX
    argNames.unshift('data', 'terminalPredicate')
    return new Function(
      ...argNames,
      `
${
  this.#arrayLike
    ? emitArrayLoop(lines, terminal)
    : emitIterableLoop(lines, terminal, opsNeedIndex || predicate.length >= 2)
}
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

function escapeRegExp(s: string): string {
  // Escape special regex characters to perform literal matches
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

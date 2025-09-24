import { buildRegExps } from './lib/buildRegExps'
import { emptyArray } from './lib/emptyArray'
import { notSpecificEnough } from './lib/notSpecificEnough'
import { tokenize } from './lib/tokenize'
import { buildOpsUnrolled, emitArrayLoop, emitIterableLoop, hasNoMatchOps } from './stream/compiler'
import { isArrayLike } from './stream/isArrayLike'
import { noMatch } from './stream/noMatch'
import type { FieldsParam, FilterFn, FilterOp, MapFn, MapOp, Op } from './stream/types'

// Private: valid JS identifier for dot-notation property access
const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

// Terminal snippets, with index call supported for operations
const TERMINAL_TO_ARRAY = '  result[emittedIndex++] = currentValue'
const TERMINAL_FOR_EACH = '  sink(currentValue, emittedIndex++)'
const TERMINAL_SOME = '  if (terminalPredicate(currentValue, emittedIndex++)) { return true }'
const TERMINAL_EVERY = '  if (!terminalPredicate(currentValue, emittedIndex++)) { return false }'
const TERMINAL_FIND =
  '  if (terminalPredicate(currentValue, emittedIndex++)) { return currentValue }'
const TERMINAL_REDUCE = `
  if (started) {
    accumulator = reducer(accumulator, currentValue, emittedIndex++)
  } else {
    accumulator = currentValue
    started = true
    emittedIndex++
  }
`
const TERMINAL_COUNT = '  emittedIndex++'

// Terminal snippets, without index support
const TERMINAL_FOR_EACH_NO_INDEX = 'sink(currentValue)'
const TERMINAL_SOME_NO_INDEX = 'if (terminalPredicate(currentValue)) { return true }'
const TERMINAL_EVERY_NO_INDEX = 'if (!terminalPredicate(currentValue)) { return false }'
const TERMINAL_FIND_NO_INDEX = 'if (terminalPredicate(currentValue)) { return currentValue }'
const TERMINAL_REDUCE_NO_INDEX = `
if (started) {
  accumulator = reducer(accumulator, currentValue)
  emittedIndex++
} else {
  accumulator = currentValue
  started = true
  emittedIndex++
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

  get length(): number {
    return hasNoMatchOps(this.#ops) ? 0 : this.count()
  }

  /**
   * Transform each element with `fn`.
   * - Lazy and single-use: returns a new Stream with the op appended.
   * @param fn mapping function `(value, index) => nextValue`
   * @returns a new Stream of U
   */
  transform<U>(fn: (value: T, index: number) => U): Stream<U> {
    const op: MapOp = { kind: 'transform', fn: fn as MapFn }
    // this type hack is necessary and intentional ↓
    return new Stream<U>(this.#source as Iterable<U>, [...this.#ops, op])
  }

  map<U>(fn: (value: T, index: number) => U): U[] {
    return this.transform(fn).toArray()
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

  range(start: number, end?: number): Stream<T> {
    const op = { kind: 'range', start, end } as Op
    return new Stream<T>(this.#source, [...this.#ops, op])
  }

  slice(start: number, end?: number): T[] {
    if (start >= 0 && (end === undefined || end >= 0)) {
      return this.range(start, end).toArray()
    }
    return this.toArray().slice(start, end)
  }

  /**
   * Limiters: implemented as range ops to enable early-stop semantics in terminals.
   */
  drop(n: number): Stream<T> {
    return this.range(n)
  }

  /**
   * Specialized text filter over one or more string fields.
   * - Splits `query` on whitespace; removes empty tokens.
   * - If no token has length > 1, the filter rejects all values.
   * - Builds case-insensitive regexes per token:
   *   - token.length < 4 => field start match ("^token")
   *   - token.length >= 4 => contains match ("token")
   * - Matching rule: each token must match at least one of the provided fields; tokens may match across different fields.
   * - Typing: when T has a string index signature (string extends keyof T), `fields` falls back to `string[]`.
   */
  filterText(query: string, ...fields: FieldsParam<T>): Stream<T> {
    const tokens = tokenize(query)
    if (fields.length === 0) {
      // No fields to search -> reject all
      return this.filter(noMatch)
    }
    if (notSpecificEnough(tokens)) {
      // No token long enough -> reject all per spec
      return this.filter(noMatch)
    }
    // Sort tokens by length (desc) to increase selectivity (in-place sort to avoid extra allocation)
    tokens.sort((a, b) => b.length - a.length)
    const regexes = buildRegExps(tokens)

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
      lines.push(`const ${v}u = ${acc}`)
      lines.push(`const ${v} = typeof ${v}u === 'string' ? ${v}u : ''`)
    }

    if (regexes.length === 1) {
      lines.push('const r = rs[0]')
      // Linear structure for single token
      const fieldCount = fieldVarNames.length
      for (let j = 0; j < fieldCount; j++) {
        lines.push(`if (r.test(${fieldVarNames[j]})) return true`)
      }
      lines.push('return false')
    } else {
      // General case: each token must match at least one field
      for (let i = 0; i < regexes.length; i++) {
        lines.push(
          `if (!(${fieldVarNames.map((v) => `rs[${i}].test(${v})`).join(' || ')})) { return false }`
        )
      }
      lines.push('return true')
    }
    const source = lines.join('\n')
    // console.log(source)
    const compiled = new Function('value', 'rs', source)
    return this.filter((value) => compiled(value, regexes))
  }

  /**
   * Keep only the first `n` elements.
   */
  take(n: number): Stream<T> {
    return this.range(0, n)
  }

  // ---- Terminals ----

  /**
   * Terminal: materialize the pipeline into an array.
   * Compiles and runs a specialized toArray for this stream.
   */
  toArray(): T[] {
    const {
      argNames,
      argValues,
      lines,
      opsNeedIndex,
      hasFilter,
      noResults,
      skipInitial,
      maxEmits,
    } = buildOpsUnrolled(this.#ops)
    if (noResults) {
      return []
    }
    argNames.unshift('data', 'SKIP', 'MAX')
    return new Function(
      ...argNames,
      `
${
  this.#arrayLike
    ? `const result = new Array((MAX >= 0 ? Math.max(0, Math.min(MAX, (data.length - SKIP) >>> 0)) : ${hasFilter ? '(data.length >>> 1)' : 'data.length'}))`
    : 'const result = []'
}
${
  this.#arrayLike
    ? emitArrayLoop(
        lines,
        TERMINAL_TO_ARRAY,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { break }'
      )
    : emitIterableLoop(
        lines,
        TERMINAL_TO_ARRAY,
        opsNeedIndex,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { break }'
      )
}
result.length = emittedIndex
return result
      `
    )(this.#source, skipInitial, maxEmits ?? -1, ...argValues)
  }

  /**
   * Terminal: forEach side effects.
   * Executes a compiled forEach with the provided sink.
   */
  forEach(fn: (value: T, index: number) => void): void {
    const { argNames, argValues, lines, opsNeedIndex, noResults, skipInitial, maxEmits } =
      buildOpsUnrolled(this.#ops)
    if (noResults) {
      return
    }
    const terminal = fn.length >= 2 ? TERMINAL_FOR_EACH : TERMINAL_FOR_EACH_NO_INDEX
    argNames.unshift('data', 'sink', 'SKIP', 'MAX')
    new Function(
      ...argNames,
      this.#arrayLike
        ? emitArrayLoop(
            lines,
            terminal,
            skipInitial > 0,
            'if (MAX >= 0 && emittedIndex >= MAX) { return }'
          )
        : emitIterableLoop(
            lines,
            terminal,
            opsNeedIndex || fn.length >= 2,
            skipInitial > 0,
            'if (MAX >= 0 && emittedIndex >= MAX) { return }'
          )
    )(this.#source, fn, skipInitial, maxEmits ?? -1, ...argValues)
  }

  /**
   * Terminal: reduce over the emitted elements.
   * If `initialValue` is omitted, the first emitted element is used as the seed.
   */
  reduce<U = T>(reducer: (previous: U, current: T, index: number) => U, initialValue?: U): U {
    const { argNames, argValues, lines, opsNeedIndex, noResults, skipInitial, maxEmits } =
      buildOpsUnrolled(this.#ops)
    if (noResults) {
      throw new TypeError('Reduce of empty stream with no initial value')
    }
    const terminal = reducer.length >= 3 ? TERMINAL_REDUCE : TERMINAL_REDUCE_NO_INDEX
    argNames.unshift('data', 'reducer', 'hasInitial', 'initialValue', 'SKIP', 'MAX')
    return new Function(
      ...argNames,
      `
let started = hasInitial
let accumulator = initialValue
${
  this.#arrayLike
    ? emitArrayLoop(
        lines,
        terminal,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { if (!started) { throw new TypeError("Reduce of empty stream with no initial value") } return accumulator }'
      )
    : emitIterableLoop(
        lines,
        terminal,
        opsNeedIndex || reducer.length >= 3,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { if (!started) { throw new TypeError("Reduce of empty stream with no initial value") } return accumulator }'
      )
}
if (!started) { throw new TypeError("Reduce of empty stream with no initial value") }
return accumulator
`
    )(
      this.#source,
      reducer,
      initialValue !== undefined,
      initialValue,
      skipInitial,
      maxEmits ?? -1,
      ...argValues
    ) as U
  }

  /**
   * Terminal: returns true if any element satisfies the predicate.
   */
  some(predicate: (value: T, index: number) => boolean): boolean {
    const { argNames, argValues, lines, opsNeedIndex, noResults, skipInitial, maxEmits } =
      buildOpsUnrolled(this.#ops)
    if (noResults) {
      return false
    }
    const terminal = predicate.length >= 2 ? TERMINAL_SOME : TERMINAL_SOME_NO_INDEX
    argNames.unshift('data', 'terminalPredicate', 'SKIP', 'MAX')
    return new Function(
      ...argNames,
      `
${
  this.#arrayLike
    ? emitArrayLoop(
        lines,
        terminal,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { return false }'
      )
    : emitIterableLoop(
        lines,
        terminal,
        opsNeedIndex || predicate.length >= 2,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { return false }'
      )
}
return false
      `
    )(this.#source, predicate, skipInitial, maxEmits ?? -1, ...argValues)
  }

  /**
   * Terminal: returns true if all elements satisfy the predicate.
   */
  every(predicate: (value: T, index: number) => boolean): boolean {
    const { argNames, argValues, lines, opsNeedIndex, noResults, skipInitial, maxEmits } =
      buildOpsUnrolled(this.#ops)
    if (noResults) {
      return false
    }
    const terminal = predicate.length >= 2 ? TERMINAL_EVERY : TERMINAL_EVERY_NO_INDEX
    argNames.unshift('data', 'terminalPredicate', 'SKIP', 'MAX')
    return new Function(
      ...argNames,
      `
${
  this.#arrayLike
    ? emitArrayLoop(
        lines,
        terminal,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { return true }'
      )
    : emitIterableLoop(
        lines,
        terminal,
        opsNeedIndex || predicate.length >= 2,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { return true }'
      )
}
return true
      `
    )(this.#source, predicate, skipInitial, maxEmits ?? -1, ...argValues)
  }

  /**
   * Terminal: returns the first element satisfying the predicate, or undefined.
   */
  find(predicate: (value: T, index: number) => boolean): T | undefined {
    const { argNames, argValues, lines, opsNeedIndex, noResults, skipInitial, maxEmits } =
      buildOpsUnrolled(this.#ops)
    if (noResults) {
      return
    }
    const terminal = predicate.length >= 2 ? TERMINAL_FIND : TERMINAL_FIND_NO_INDEX
    argNames.unshift('data', 'terminalPredicate', 'SKIP', 'MAX')
    return new Function(
      ...argNames,
      `
${
  this.#arrayLike
    ? emitArrayLoop(
        lines,
        terminal,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { return undefined }'
      )
    : emitIterableLoop(
        lines,
        terminal,
        opsNeedIndex || predicate.length >= 2,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { return undefined }'
      )
}
return undefined
      `
    )(this.#source, predicate, skipInitial, maxEmits ?? -1, ...argValues)
  }

  /**
   * Terminal: count emitted elements efficiently with early-stop.
   */
  count(): number {
    const { argNames, argValues, lines, opsNeedIndex, noResults, skipInitial, maxEmits } =
      buildOpsUnrolled(this.#ops)
    if (noResults) return 0
    argNames.unshift('data', 'SKIP', 'MAX')
    return new Function(
      ...argNames,
      `
${
  this.#arrayLike
    ? emitArrayLoop(
        lines,
        TERMINAL_COUNT,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { return emittedIndex }'
      )
    : emitIterableLoop(
        lines,
        TERMINAL_COUNT,
        opsNeedIndex,
        skipInitial > 0,
        'if (MAX >= 0 && emittedIndex >= MAX) { return emittedIndex }'
      )
}
return emittedIndex
      `
    )(this.#source, skipInitial, maxEmits ?? -1, ...argValues) as number
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

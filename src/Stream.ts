import { buildRegExps } from './lib/buildRegExps'
import { emptyArray } from './lib/emptyArray'
import { notSpecificEnough } from './lib/notSpecificEnough'
import { tokenize } from './lib/tokenize'
import { hasNoMatchOps } from './stream/compiler'
import { DebugStream } from './stream/DebugStream'
import { FILTER_TEXT_HINTS, type FilterTextHints } from './stream/FilterTextHints'
import { noMatch } from './stream/noMatch'
import { StreamCompiler } from './stream/StreamCompiler'
import type {
  CompiledResult,
  FieldsParam,
  FilterFn,
  FilterOp,
  MapFn,
  MapOp,
  Op,
} from './stream/types'

// Private: valid JS identifier for dot-notation property access
const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

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

  constructor(source: Iterable<T> | ArrayLike<T>, ops?: readonly Op[]) {
    this.#source = source
    this.#ops = ops ?? emptyArray<Op>()
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
    const compiled = new Function('value', 'rs', source)

    // Wrap predicate; attach minimal, non-enumerable hints for optional debug rendering
    const filterFn: FilterFn = ((value: unknown) => compiled(value as never, regexes)) as FilterFn
    Object.defineProperty(filterFn, FILTER_TEXT_HINTS, {
      value: { query, tokens, regexes, fields: fields.map((f) => String(f)) } as FilterTextHints,
      enumerable: false,
    })

    return this.filter(filterFn)
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
    const compiled = new StreamCompiler<T>(this.#source, this.#ops).compileToArray()
    if (compiled.noResults) return []
    return execute(compiled)
  }

  /**
   * Terminal: forEach side effects.
   * Executes a compiled forEach with the provided sink.
   */
  forEach(fn: (value: T, index: number) => void): void {
    const compiled = new StreamCompiler<T>(this.#source, this.#ops).compileForEach(fn)
    if (compiled.noResults) return
    execute(compiled)
  }

  /**
   * Terminal: reduce over the emitted elements.
   * If `initialValue` is omitted, the first emitted element is used as the seed.
   */
  reduce<U = T>(reducer: (previous: U, current: T, index: number) => U, initialValue?: U): U {
    const compiled = new StreamCompiler<T>(this.#source, this.#ops).compileReduce(
      reducer as unknown as (p: unknown, c: T, i: number) => unknown,
      initialValue
    )
    if (compiled.noResults) {
      throw new TypeError('Reduce of empty stream with no initial value')
    }
    return execute(compiled)
  }

  /**
   * Terminal: returns true if any element satisfies the predicate.
   */
  some(predicate: (value: T, index: number) => boolean): boolean {
    const compiled = new StreamCompiler<T>(this.#source, this.#ops).compileSome(predicate)
    if (compiled.noResults) return false
    return execute(compiled)
  }

  /**
   * Terminal: returns true if all elements satisfy the predicate.
   */
  every(predicate: (value: T, index: number) => boolean): boolean {
    const compiled = new StreamCompiler<T>(this.#source, this.#ops).compileEvery(predicate)
    if (compiled.noResults) return false
    return execute(compiled)
  }

  /**
   * Terminal: returns the first element satisfying the predicate, or undefined.
   */
  find(predicate: (value: T, index: number) => boolean): T | undefined {
    const compiled = new StreamCompiler<T>(this.#source, this.#ops).compileFind(predicate)
    if (compiled.noResults) return undefined
    return execute(compiled)
  }

  /**
   * Terminal: count emitted elements efficiently with early-stop.
   */
  count(): number {
    const compiled = new StreamCompiler<T>(this.#source, this.#ops).compileCount()
    if (compiled.noResults) return 0
    return execute(compiled)
  }

  /**
   * Debug/diagnostic label describing the source kind and ops chain.
   */
  toString(): string {
    const sourceType = this.#source?.constructor?.name ?? this.#source?.toString() ?? 'unknown'
    const ops = this.#ops.map((op) => op.kind).join('->')
    return `Stream(${sourceType}, ${ops})`
  }

  /** Return a debug view of this Stream. */
  debug(): DebugStream<T> {
    return new DebugStream<T>(this.#source, this.#ops, this.toString())
  }
}

function execute<R>(compiled: CompiledResult): R {
  return new Function(...compiled.argNames, compiled.body)(...compiled.values) as R
}

/**
 * Helper to create a Stream from any Iterable.
 */
export function stream<T>(source: Iterable<T>): Stream<T> {
  return new Stream<T>(source)
}

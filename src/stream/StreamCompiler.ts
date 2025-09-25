import { buildOpsUnrolled, emitArrayLoop, emitIterableLoop } from './compiler'
import { FILTER_TEXT_HINTS, type FilterTextHints } from './FilterTextHints'
import { isArrayLike } from './isArrayLike'
import type { CompiledResult, Op } from './types'

export class StreamCompiler<T> {
  private readonly source: Iterable<T> | ArrayLike<T>
  private readonly ops: readonly Op[]
  private readonly debug: boolean
  private readonly arrayLike: boolean

  constructor(source: Iterable<T> | ArrayLike<T>, ops: readonly Op[], debug?: true) {
    this.source = source
    this.ops = ops
    this.debug = debug ?? false
    this.arrayLike = isArrayLike(this.source)
  }

  #withDebug(
    base: Omit<CompiledResult, 'opArgNames' | 'opArgValues' | 'opDebug'>,
    opArgNames: readonly string[],
    opArgValues: readonly unknown[]
  ): CompiledResult {
    if (!this.debug) return base
    const opDebug: Array<{ op: string; info: unknown }> = []
    for (let i = 0; i < opArgValues.length; i++) {
      const v = opArgValues[i]
      if (typeof v === 'function') {
        const maybe = v as unknown as Record<PropertyKey, unknown>
        const hints = maybe[FILTER_TEXT_HINTS] as FilterTextHints | undefined
        if (hints) {
          const compiledBody = this.#buildFilterTextBody(hints.tokens, hints.fields)
          opDebug.push({
            op: 'filterText',
            info: { tokens: hints.tokens, regexes: hints.regexes, compiledBody },
          })
        }
      }
    }
    return { ...base, opArgNames, opArgValues, opDebug: opDebug.length ? opDebug : undefined }
  }

  #buildFilterTextBody(tokens: readonly string[], fields: readonly string[]): string {
    const IdentifierRe = /^[A-Za-z_$][A-Za-z0-9_$]*$/
    const fieldVarNames = fields.map((_f, i) => `v${i + 1}`)
    const fieldAccessors = fields.map((f) => {
      const key = String(f)
      return IdentifierRe.test(key) ? `value.${key}` : `value[${JSON.stringify(key)}]`
    })
    const lines: string[] = []
    for (let i = 0; i < fieldVarNames.length; i++) {
      const v = fieldVarNames[i]
      const acc = fieldAccessors[i]
      lines.push(`const ${v}u = ${acc}`)
      lines.push(`const ${v} = typeof ${v}u === 'string' ? ${v}u : ''`)
    }
    if (tokens.length === 1) {
      lines.push('const r = rs[0]')
      for (let j = 0; j < fieldVarNames.length; j++) {
        lines.push(`if (r.test(${fieldVarNames[j]})) return true`)
      }
      lines.push('return false')
    } else {
      for (let i = 0; i < tokens.length; i++) {
        lines.push(
          `if (!(${fieldVarNames.map((v) => `rs[${i}].test(${v})`).join(' || ')})) { return false }`
        )
      }
      lines.push('return true')
    }
    return lines.join('\n')
  }

  compileToArray(): CompiledResult {
    const {
      argNames: opArgNames,
      argValues: opArgValues,
      lines,
      opsNeedIndex,
      hasFilter,
      noResults,
      skipInitial,
      maxEmits,
    } = buildOpsUnrolled(this.ops)

    if (noResults) {
      return this.#withDebug(
        {
          argNames: [],
          body: 'return []',
          values: [],
          noResults,
          arrayLike: this.arrayLike,
          skipInitial,
          maxEmits,
        },
        opArgNames,
        opArgValues
      )
    }

    const argNames = [...opArgNames]
    argNames.unshift('data', 'SKIP', 'MAX')

    const body = `
${
  this.arrayLike
    ? `const result = new Array((MAX >= 0 ? Math.max(0, Math.min(MAX, (data.length - SKIP) >>> 0)) : ${hasFilter ? '(data.length >>> 1)' : 'data.length'}))`
    : 'const result = []'
}
${
  this.arrayLike
    ? emitArrayLoop(
        lines,
        '  result[emittedIndex++] = currentValue',
        skipInitial > 0,
        '  if (MAX >= 0 && emittedIndex >= MAX) { break }'
      )
    : emitIterableLoop(
        lines,
        '  result[emittedIndex++] = currentValue',
        opsNeedIndex,
        skipInitial > 0,
        '  if (MAX >= 0 && emittedIndex >= MAX) { break }'
      )
}
result.length = emittedIndex
return result`

    const values = [this.source, skipInitial, maxEmits ?? -1, ...opArgValues]

    return this.#withDebug(
      { argNames, body, values, noResults, arrayLike: this.arrayLike, skipInitial, maxEmits },
      opArgNames,
      opArgValues
    )
  }

  compileForEach(fn: (value: T, index: number) => void): CompiledResult {
    const {
      argNames: opArgNames,
      argValues: opArgValues,
      lines,
      opsNeedIndex,
      noResults,
      skipInitial,
      maxEmits,
    } = buildOpsUnrolled(this.ops)

    if (noResults) {
      return this.#withDebug(
        {
          argNames: [],
          body: 'return',
          values: [],
          noResults,
          arrayLike: this.arrayLike,
          skipInitial,
          maxEmits,
        },
        opArgNames,
        opArgValues
      )
    }

    const terminal = fn.length >= 2 ? '  sink(currentValue, emittedIndex++)' : 'sink(currentValue)'
    const argNames = [...opArgNames]
    argNames.unshift('data', 'sink', 'SKIP', 'MAX')

    const body = this.arrayLike
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

    const values = [this.source, fn, skipInitial, maxEmits ?? -1, ...opArgValues]

    return this.#withDebug(
      { argNames, body, values, noResults, arrayLike: this.arrayLike, skipInitial, maxEmits },
      opArgNames,
      opArgValues
    )
  }

  compileReduce<U = T>(
    reducer: (previous: U, current: T, index: number) => U,
    initialValue?: U
  ): CompiledResult {
    const {
      argNames: opArgNames,
      argValues: opArgValues,
      lines,
      opsNeedIndex,
      noResults,
      skipInitial,
      maxEmits,
    } = buildOpsUnrolled(this.ops)

    if (noResults) {
      return this.#withDebug(
        {
          argNames: [],
          body: `if (!hasInitial) { throw new TypeError("Reduce of empty stream with no initial value") }
return initialValue`,
          values: [],
          noResults,
          arrayLike: this.arrayLike,
          skipInitial,
          maxEmits,
        },
        opArgNames,
        opArgValues
      )
    }

    const terminal = `
  if (started) {
    accumulator = reducer(accumulator, currentValue, emittedIndex++)
  } else {
    accumulator = currentValue
    started = true
    emittedIndex++
  }
`

    const loop = this.arrayLike
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

    const body = `
let started = hasInitial
let accumulator = initialValue
${loop}
if (!started) { throw new TypeError("Reduce of empty stream with no initial value") }
return accumulator`

    const values = [
      this.source,
      reducer,
      initialValue !== undefined,
      initialValue,
      skipInitial,
      maxEmits ?? -1,
      ...opArgValues,
    ]

    return this.#withDebug(
      {
        argNames: ['data', 'reducer', 'hasInitial', 'initialValue', 'SKIP', 'MAX', ...opArgNames],
        body,
        values,
        noResults,
        arrayLike: this.arrayLike,
        skipInitial,
        maxEmits,
      },
      opArgNames,
      opArgValues
    )
  }

  compileSome(predicate: (value: T, index: number) => boolean): CompiledResult {
    const {
      argNames: opArgNames,
      argValues: opArgValues,
      lines,
      opsNeedIndex,
      noResults,
      skipInitial,
      maxEmits,
    } = buildOpsUnrolled(this.ops)

    if (noResults) {
      return this.#withDebug(
        {
          argNames: [],
          body: 'return false',
          values: [],
          noResults,
          arrayLike: this.arrayLike,
          skipInitial,
          maxEmits,
        },
        opArgNames,
        opArgValues
      )
    }

    const terminal =
      predicate.length >= 2
        ? '  if (terminalPredicate(currentValue, emittedIndex++)) { return true }'
        : '  if (terminalPredicate(currentValue)) { return true }'
    const argNames = [...opArgNames]
    argNames.unshift('data', 'terminalPredicate', 'SKIP', 'MAX')

    let body = this.arrayLike
      ? emitArrayLoop(
          lines,
          terminal,
          skipInitial > 0,
          '  if (MAX >= 0 && emittedIndex >= MAX) { return false }'
        )
      : emitIterableLoop(
          lines,
          terminal,
          opsNeedIndex || predicate.length >= 2,
          skipInitial > 0,
          '  if (MAX >= 0 && emittedIndex >= MAX) { return false }'
        )
    body += `
return false`

    const values = [this.source, predicate, skipInitial, maxEmits ?? -1, ...opArgValues]

    return this.#withDebug(
      { argNames, body, values, noResults, arrayLike: this.arrayLike, skipInitial, maxEmits },
      opArgNames,
      opArgValues
    )
  }

  compileEvery(predicate: (value: T, index: number) => boolean): CompiledResult {
    const {
      argNames: opArgNames,
      argValues: opArgValues,
      lines,
      opsNeedIndex,
      noResults,
      skipInitial,
      maxEmits,
    } = buildOpsUnrolled(this.ops)

    if (noResults) {
      return this.#withDebug(
        {
          argNames: [],
          body: 'return false',
          values: [],
          noResults,
          arrayLike: this.arrayLike,
          skipInitial,
          maxEmits,
        },
        opArgNames,
        opArgValues
      )
    }

    const terminal =
      predicate.length >= 2
        ? '  if (!terminalPredicate(currentValue, emittedIndex++)) { return false }'
        : 'if (!terminalPredicate(currentValue)) { return false }'
    const argNames = [...opArgNames]
    argNames.unshift('data', 'terminalPredicate', 'SKIP', 'MAX')

    let body = this.arrayLike
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
    body += `
return true`

    const values = [this.source, predicate, skipInitial, maxEmits ?? -1, ...opArgValues]

    return this.#withDebug(
      { argNames, body, values, noResults, arrayLike: this.arrayLike, skipInitial, maxEmits },
      opArgNames,
      opArgValues
    )
  }

  compileFind(predicate: (value: T, index: number) => boolean): CompiledResult {
    const {
      argNames: opArgNames,
      argValues: opArgValues,
      lines,
      opsNeedIndex,
      noResults,
      skipInitial,
      maxEmits,
    } = buildOpsUnrolled(this.ops)

    if (noResults) {
      return this.#withDebug(
        {
          argNames: [],
          body: 'return',
          values: [],
          noResults,
          arrayLike: this.arrayLike,
          skipInitial,
          maxEmits,
        },
        opArgNames,
        opArgValues
      )
    }

    const terminal =
      predicate.length >= 2
        ? '  if (terminalPredicate(currentValue, emittedIndex++)) { return currentValue }'
        : 'if (terminalPredicate(currentValue)) { return currentValue }'
    const argNames = [...opArgNames]
    argNames.unshift('data', 'terminalPredicate', 'SKIP', 'MAX')

    let body = this.arrayLike
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
    body += `
return undefined`

    const values = [this.source, predicate, skipInitial, maxEmits ?? -1, ...opArgValues]

    return this.#withDebug(
      { argNames, body, values, noResults, arrayLike: this.arrayLike, skipInitial, maxEmits },
      opArgNames,
      opArgValues
    )
  }

  compileCount(): CompiledResult {
    const {
      argNames: opArgNames,
      argValues: opArgValues,
      lines,
      opsNeedIndex,
      noResults,
      skipInitial,
      maxEmits,
    } = buildOpsUnrolled(this.ops)

    if (noResults) {
      return this.#withDebug(
        {
          argNames: [],
          body: 'return 0',
          values: [],
          noResults,
          arrayLike: this.arrayLike,
          skipInitial,
          maxEmits,
        },
        opArgNames,
        opArgValues
      )
    }

    const argNames = [...opArgNames]
    argNames.unshift('data', 'SKIP', 'MAX')

    let body = this.arrayLike
      ? emitArrayLoop(
          lines,
          '  emittedIndex++',
          skipInitial > 0,
          'if (MAX >= 0 && emittedIndex >= MAX) { return emittedIndex }'
        )
      : emitIterableLoop(
          lines,
          '  emittedIndex++',
          opsNeedIndex,
          skipInitial > 0,
          'if (MAX >= 0 && emittedIndex >= MAX) { return emittedIndex }'
        )
    body += `
return emittedIndex`

    const values = [this.source, skipInitial, maxEmits ?? -1, ...opArgValues]

    return this.#withDebug(
      { argNames, body, values, noResults, arrayLike: this.arrayLike, skipInitial, maxEmits },
      opArgNames,
      opArgValues
    )
  }
}

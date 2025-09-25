import { StreamCompiler } from './StreamCompiler'
import type { CompiledResult, Op } from './types'

export class DebugStream<T> {
  readonly #tag: string
  readonly #compiler: StreamCompiler<T>

  constructor(source: Iterable<T> | ArrayLike<T>, ops: readonly Op[], tag: string) {
    this.#tag = tag
    this.#compiler = new StreamCompiler<T>(source, ops, true)
  }

  private stringify(val: unknown): string {
    if (typeof val === 'function') return (val as Function).toString()
    if (val instanceof RegExp) return val.toString()
    try {
      return JSON.stringify(val)
    } catch {
      return String(val)
    }
  }

  private appendOps(lines: string[], compiled: CompiledResult): void {
    const names = compiled.opArgNames ?? []
    const values = compiled.opArgValues ?? []
    if (names.length > 0 && values.length > 0) {
      lines.push('  ops:')
      for (let i = 0; i < names.length; i++) {
        const name = names[i] ?? `arg${i + 1}`
        const v = values[i]
        lines.push(`   - ${name}: ${this.stringify(v)}`)
      }
    }
  }

  private appendOpDebug(lines: string[], compiled: CompiledResult): void {
    if (compiled.opDebug?.length) {
      for (const d of compiled.opDebug) {
        if (d.op === 'filterText') {
          const info = d.info as { tokens: string[]; regexes: RegExp[]; compiledBody?: string }
          lines.push(
            `    filterText: tokens=${JSON.stringify(info.tokens)}, regexes=[${info.regexes.map((r) => r.toString()).join(', ')}]`
          )
          if (info.compiledBody) {
            lines.push(`    compiled: { 
    ${info.compiledBody.replace(/\n/g, '\n      ')}\n    }`)
          }
        }
      }
    }
  }

  private renderHeader(
    kind: string,
    compiled: CompiledResult,
    terminalInfo?: Record<string, unknown>
  ): string {
    const lines: string[] = []
    lines.push(`  /*
    Debug ${kind}:`)
    lines.push(`    tag: ${this.#tag}`)
    const { arrayLike, skipInitial, maxEmits } = compiled
    lines.push(`    arrayLike: ${arrayLike}, SKIP: ${skipInitial}, MAX: ${maxEmits}`)

    this.appendOps(lines, compiled)

    // Extra debug per-op (e.g., filterText)
    this.appendOpDebug(lines, compiled)

    if (terminalInfo) {
      lines.push('    terminal:')
      for (const [k, v] of Object.entries(terminalInfo)) {
        lines.push(`     - ${k}: ${this.stringify(v)}`)
      }
    }

    lines.push('  */')
    return lines.join('\n')
  }

  toArray(): string {
    const compiled = this.#compiler.compileToArray()
    if (compiled.noResults) {
      return renderNoResults('toArray', '[]')
    }
    const header = this.renderHeader('toArray', compiled)
    return renderSource(compiled, header)
  }

  forEach(fn: (value: T, index: number) => void): string {
    const compiled = this.#compiler.compileForEach(fn)
    if (compiled.noResults) {
      return renderNoResults('forEach', '')
    }
    const header = this.renderHeader('forEach', compiled, { sink: fn })
    return renderSource(compiled, header)
  }

  reduce<U = T>(reducer: (previous: U, current: T, index: number) => U, initialValue?: U): string {
    const compiled = this.#compiler.compileReduce(reducer, initialValue)
    const header = this.renderHeader('reduce', compiled, { reducer, initialValue })
    return renderSource(compiled, header)
  }

  some(predicate: (value: T, index: number) => boolean): string {
    const compiled = this.#compiler.compileSome(predicate)
    if (compiled.noResults) {
      return renderNoResults('some', 'false')
    }
    const header = this.renderHeader('some', compiled, { predicate })
    return renderSource(compiled, header)
  }

  every(predicate: (value: T, index: number) => boolean): string {
    const compiled = this.#compiler.compileEvery(predicate)
    if (compiled.noResults) {
      return renderNoResults('every', 'false')
    }
    const header = this.renderHeader('every', compiled, { predicate })
    return renderSource(compiled, header)
  }

  find(predicate: (value: T, index: number) => boolean): string {
    const compiled = this.#compiler.compileFind(predicate)
    if (compiled.noResults) {
      return renderNoResults('find', 'undefined')
    }
    const header = this.renderHeader('find', compiled, { predicate })
    return renderSource(compiled, header)
  }

  count(): string {
    const compiled = this.#compiler.compileCount()
    if (compiled.noResults) {
      return renderNoResults('count', '0')
    }
    const header = this.renderHeader('count', compiled)
    return renderSource(compiled, header)
  }
}

function renderSource(compiled: CompiledResult, header: string) {
  return `function anonymous(${compiled.argNames.join(', ')}) {
${header}
${compiled.body}
}`
}

function renderNoResults(op: string, returnValue: string) {
  return `function anonymous() {
  /*
    Debug ${op}: noResults
  */
  return ${returnValue}
}`
}

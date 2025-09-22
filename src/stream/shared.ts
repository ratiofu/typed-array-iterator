import type { BuiltOps, FilterFn, MapFn, Op } from './types'

/**
 * Lower-level helper used by all compile* terminals to prepare the fused pipeline.
 *
 * Responsibilities:
 * - Walk the ops array once and build:
 *   - `lines`: JS source lines that implement map/filter fusion in the hot loop
 *   - `argNames`: parameter names for each unique user function
 *   - `argValues`: the actual function references passed to `new Function`
 * - Keeps types explicit (no `any`); accepts/returns unknown-based function types.
 * - Intentionally simple naming (mapN/filterN) to keep generated code readable.
 */
export function buildOpsUnrolled(ops: readonly Op[]): BuiltOps {
  const mapFns: MapFn[] = []
  const filterFns: FilterFn[] = []
  const mapNames: string[] = []
  const filterNames: string[] = []
  const lines: string[] = []
  let opsNeedIndex = false

  for (let i = 0; i < ops.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: we know this is in-bounds
    const op = ops[i]!
    if (op.kind === 'filter') {
      filterFns.push(op.fn)
      const argName = `filter${filterFns.length}`
      filterNames.push(argName)
      opsNeedIndex ||= op.fn.length >= 2
      lines.push(
        op.fn.length >= 2
          ? `  if (!${argName}(currentValue, index)) { continue }`
          : `  if (!${argName}(currentValue)) { continue }`
      )
    } else {
      mapFns.push(op.fn)
      const argName = `map${mapFns.length}`
      mapNames.push(argName)
      opsNeedIndex ||= op.fn.length >= 2
      lines.push(
        op.fn.length >= 2
          ? `  currentValue = ${argName}(currentValue, index)`
          : `  currentValue = ${argName}(currentValue)`
      )
    }
  }

  const argNames = [...filterNames, ...mapNames]
  const argValues: ReadonlyArray<MapFn | FilterFn> = [...filterFns, ...mapFns]

  return { argNames, argValues, lines, opsNeedIndex }
}

/**
 * Emit the common array-like loop with fused pipeline `lines` and terminal `terminalLines`.
 */
export function emitArrayLoop(lines: readonly string[], terminal: string): string {
  return `
const dataLength = data.length
let emittedIndex = 0
for (let index = 0; index < dataLength; index++) {
  let currentValue = data[index]
${lines.join('\n')}
${terminal}
}`
}

/**
 * Emit the common iterable loop with fused pipeline `lines` and terminal `terminalLines`.
 */
export function emitIterableLoop(
  lines: readonly string[],
  terminal: string,
  needsIndex = true
): string {
  return needsIndex
    ? `
let logicalIndex = 0
let emittedIndex = 0
for (const currentValueRaw of data) {
  let currentValue = currentValueRaw
  const index = logicalIndex++
${lines.join('\n')}
${terminal}
}`
    : `
let emittedIndex = 0
for (const currentValueRaw of data) {
  let currentValue = currentValueRaw
${lines.join('\n')}
${terminal}
}`
}

const emptyArraySingleton: readonly unknown[] = Object.freeze([])

export function emptyArray<T>(): readonly T[] {
  return emptyArraySingleton as readonly T[]
}

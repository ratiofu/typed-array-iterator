import { emptyArray } from '../lib/emptyArray'
import { noMatch } from './noMatch'
import type { BuiltOps, FilterFn, MapFn, Op, OpFn } from './types'

function hasAnyFilter(ops: readonly Op[]): boolean {
  return ops.some((op) => op.kind === 'filter')
}

export function hasNoMatchOps(ops: readonly Op[]): boolean {
  return ops.some((op) => 'fn' in op && op.fn === noMatch)
}

type OpsState = {
  lines: string[]
  mapFns: MapFn[]
  mapNames: string[]
  filterFns: FilterFn[]
  filterNames: string[]
  opsNeedIndex: boolean
}

function addFilterOp(fn: FilterFn, state: OpsState) {
  state.filterFns.push(fn)
  const argName = `filter${state.filterFns.length}`
  state.filterNames.push(argName)
  state.opsNeedIndex ||= fn.length >= 2
  state.lines.push(
    fn.length >= 2
      ? `  if (!${argName}(currentValue, index)) { continue }`
      : `  if (!${argName}(currentValue)) { continue }`
  )
}

function addMapOp(fn: MapFn, state: OpsState) {
  state.mapFns.push(fn)
  const argName = `map${state.mapFns.length}`
  state.mapNames.push(argName)
  state.opsNeedIndex ||= fn.length >= 2
  state.lines.push(
    fn.length >= 2
      ? `  currentValue = ${argName}(currentValue, index)`
      : `  currentValue = ${argName}(currentValue)`
  )
}

type RangeAgg = { skipInitial: number; maxEmits: number | null }
function applyRange(start: number, end: number | undefined, agg: RangeAgg) {
  const s = Math.max(0, start | 0)
  const len = end === undefined ? null : Math.max(0, (end | 0) - s)
  agg.skipInitial += s
  if (len != null) {
    agg.maxEmits = agg.maxEmits == null ? len : Math.min(agg.maxEmits, len)
  }
  if (agg.maxEmits != null) {
    agg.maxEmits = Math.max(0, agg.maxEmits)
  }
}

const NO_RESULTS: BuiltOps = Object.freeze({
  argNames: [],
  argValues: emptyArray<OpFn>(),
  lines: emptyArray<string>(),
  opsNeedIndex: false,
  hasFilter: true,
  noResults: true,
  skipInitial: 0,
  maxEmits: 0,
})

/**
 * Lower-level helper used by all compile* terminals to prepare the fused pipeline.
 *
 * Responsibilities:
 * - Walk the ops array once and build:
 *   - `lines`: JS source lines that implement transform/filter fusion in the hot loop
 *   - `argNames`: parameter names for each unique user function
 *   - `argValues`: the actual function references passed to `new Function`
 * - Keeps types explicit (no `any`); accepts/returns unknown-based function types.
 * - Intentionally simple naming (mapN/filterN) to keep generated code readable.
 */
export function buildOpsUnrolled(ops: readonly Op[]): BuiltOps {
  const hasFilter = hasAnyFilter(ops)
  const hasPositiveStartRange = ops.some((op) => op.kind === 'range' && (op.start | 0) > 0)
  if (hasFilter && hasPositiveStartRange) {
    throw new Error(
      'Stream limitation: range(start > 0) with filters is not yet supported. ' +
        'Use range(0, n)/take() or move filters after slice materialization for now. ' +
        'See README.md and multi-range-support.md for details.'
    )
  }
  if (hasFilter && hasNoMatchOps(ops)) {
    return { ...NO_RESULTS, argNames: [], skipInitial: 0, maxEmits: 0 }
  }

  const state: OpsState = {
    lines: [],
    mapFns: [],
    mapNames: [],
    filterFns: [],
    filterNames: [],
    opsNeedIndex: false,
  }

  const agg: RangeAgg = { skipInitial: 0, maxEmits: null }

  for (let i = 0; i < ops.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: we know this is in-bounds
    const op = ops[i]!
    switch (op.kind) {
      case 'filter': {
        addFilterOp(op.fn, state)
        break
      }
      case 'transform': {
        addMapOp(op.fn, state)
        break
      }
      case 'range': {
        applyRange(op.start, op.end, agg)
        break
      }
    }
  }

  const { lines, mapFns, mapNames, filterFns, filterNames, opsNeedIndex } = state
  const argNames = [...filterNames, ...mapNames]
  const argValues = [...filterFns, ...mapFns]

  return {
    argNames,
    argValues,
    lines,
    opsNeedIndex,
    hasFilter,
    noResults: false,
    skipInitial: agg.skipInitial,
    maxEmits: agg.maxEmits,
  }
}

function skipPrelude(needsSkip: boolean) {
  return needsSkip ? 'let skipLeft = SKIP' : ''
}

function skipCheck(needsSkip: boolean) {
  return needsSkip ? 'if (skipLeft > 0) { skipLeft--; continue }' : ''
}

/**
 * Emit the common array-like loop with fused pipeline `lines` and terminal `terminalLines`.
 */
export function emitArrayLoop(
  lines: readonly string[],
  terminal: string,
  needsSkip = false,
  earlyStopAfterEmit = ''
): string {
  return `
${skipPrelude(needsSkip)}
const dataLength = data.length
let emittedIndex = 0
for (let index = 0; index < dataLength; index++) {
  let currentValue = data[index]
  ${skipCheck(needsSkip)}
${lines.join('\n')}
${terminal}
${earlyStopAfterEmit}
}`
}

/**
 * Emit the common iterable loop with fused pipeline `lines` and terminal `terminalLines`.
 */
export function emitIterableLoop(
  lines: readonly string[],
  terminal: string,
  needsIndex = true,
  needsSkip = false,
  earlyStopAfterEmit = ''
): string {
  return needsIndex
    ? `
${skipPrelude(needsSkip)}
let logicalIndex = 0
let emittedIndex = 0
for (const currentValueRaw of data) {
  let currentValue = currentValueRaw
  const index = logicalIndex++
  ${skipCheck(needsSkip)}
${lines.join('\n')}
${terminal}
${earlyStopAfterEmit}
}`
    : `
${skipPrelude(needsSkip)}
let emittedIndex = 0
for (const currentValueRaw of data) {
  let currentValue = currentValueRaw
  ${skipCheck(needsSkip)}
${lines.join('\n')}
${terminal}
${earlyStopAfterEmit}
}`
}

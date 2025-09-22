import type { BuiltOps, FilterFn, MapFn, Op } from '../types'

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

  for (let i = 0; i < ops.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: we know this is in-bounds
    const op = ops[i]!
    if (op.kind === 'filter') {
      filterFns.push(op.fn as FilterFn)
      const argName = `filter${filterFns.length}`
      filterNames.push(argName)
      lines.push(`if (!${argName}(currentValue, index)) { continue }`)
    } else {
      mapFns.push(op.fn as MapFn)
      const argName = `map${mapFns.length}`
      mapNames.push(argName)
      lines.push(`currentValue = ${argName}(currentValue, index)`)
    }
  }

  const argNames = [...filterNames, ...mapNames]
  const argValues: ReadonlyArray<MapFn | FilterFn> = [...filterFns, ...mapFns]

  return { argNames, argValues, lines }
}

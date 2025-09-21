import type { BuiltOps, FilterFn, MapFn, Op } from '../types'

/**
 * Build unrolled ops lines and gather function argument names/values in one pass.
 * - Derives stable, readable argument names from the provided function names (sanitized)
 * - Ensures uniqueness across all generated parameter names
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

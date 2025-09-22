export type MapFn<I = unknown, O = unknown> = (value: I, index: number) => O
export type FilterFn<I = unknown> = (value: I, index: number) => boolean

export type MapOp = { kind: 'map'; fn: MapFn }
export type FilterOp = { kind: 'filter'; fn: FilterFn }
export type Op = MapOp | FilterOp

export type BuiltOps = {
  argNames: string[]
  argValues: ReadonlyArray<MapFn | FilterFn>
  lines: string[]
  opsNeedIndex: boolean
}

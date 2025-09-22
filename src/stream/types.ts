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

// Exclude index signatures from keyof T so we only consider known, declared property keys
export type KnownKeys<T> = {
  [K in keyof T]: string extends K ? never : number extends K ? never : symbol extends K ? never : K
}[keyof T]

export type StringFieldKeys<T> = Extract<
  { [K in KnownKeys<T>]-?: T[K] extends string | null | undefined ? K : never }[KnownKeys<T>],
  string
>

// Fields parameter type for text filtering:
// - If T has a string index signature (string extends keyof T), fall back to any string key
// - Otherwise, restrict to keys whose value type is string | null | undefined
export type FieldsParam<T> = string extends keyof T ? string[] : StringFieldKeys<T>[]

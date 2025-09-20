export const SKIP = Symbol('SKIP')
export type ResultSkip = typeof SKIP
export const DONE = Object.freeze({ done: true, value: undefined })
export type ResultDone = typeof DONE & IteratorReturnResult<undefined>

export type MapOp = { kind: 'map'; fn: (value: unknown, index: number) => unknown }
export type FilterOp = { kind: 'filter'; predicate: (value: unknown, index: number) => boolean }
export const FLATTEN_OP = { kind: 'flatten' }
export type FlattenOp = typeof FLATTEN_OP
export type Op = MapOp | FilterOp | FlattenOp

export function asArrayLikeOrNull(source: Iterable<unknown>): ArrayLike<unknown> | null {
  return Array.isArray(source) || ArrayBuffer?.isView?.(source as unknown)
    ? (source as unknown as ArrayLike<unknown>)
    : null
}

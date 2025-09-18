export type TypedArray<T extends Record<string, unknown>> = {
  fields: (keyof T)[]
  data: T[keyof T][][]
}

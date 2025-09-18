/**
 * Type representing a packed array of objects including their field names.
 */
export type TypedArray<T extends Record<string, unknown>> = {
  /**
   * Array of field names corresponding to the data columns, in the same order as the data.
   */
  fields: (keyof T)[]
  /**
   * 2D array representing the data rows. Each inner array corresponds to a row,
   * with values in the same order as the field names.
   */
  data: T[keyof T][][]
}

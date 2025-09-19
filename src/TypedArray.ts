/**
 * Compact representation of JSON data as two arrays:
 * 1. an array of ordered field names
 * 2. an array of the individual "records", each an array of ordered values
 *
 * For example:
 * ```json
 * {
 *   "fields": ["id", "name", "emailAddress"],
 *   "data": [
 *     [1234, "David Röhn", null],
 *     [1235, "Alex Norquist", "an@example.com"]
 *   ]
 * }
 * ```
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

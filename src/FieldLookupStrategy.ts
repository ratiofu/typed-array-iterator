/**
 * Determines how the [TypedArrayProxy] actually performs the lookup from
 * field names to their corresponding indices. This is configurable at
 * construction time to allow for different performance characteristics.
 */
export type FieldLookupStrategy = 'map' // more in the future

export type FieldLookup<T> = (fieldName: keyof T) => number | undefined

/**
 * Factory function for Map-based field lookup strategy.
 * Creates a Map for O(1) field name to index lookups.
 */
function buildMapLookup<T>(names: Array<keyof T>): FieldLookup<T> {
  const fieldMap = new Map(names.map((field, index) => [field, index]))
  return (fieldName: keyof T) => fieldMap.get(fieldName)
}

/**
 * Build a field lookup function based on the specified strategy.
 *
 * @param strategy - The lookup strategy to use
 * @param fields - Array of field names to create lookup for
 * @returns A function that can lookup field indices by name
 */
export function buildLookup<T>(
  strategy: FieldLookupStrategy,
  fields: Array<keyof T>
): (fieldName: keyof T) => number | undefined {
  switch (strategy) {
    case 'map':
      return buildMapLookup(fields)
    default:
      throw new Error(`Unknown field lookup strategy: ${strategy}`)
  }
}

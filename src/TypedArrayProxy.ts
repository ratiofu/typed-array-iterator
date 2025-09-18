import type { TypedArray } from './TypedArray'

/**
 * A memory-efficient, type-safe proxy for iterating over packed arrays representing objects.
 *
 * TypedArrayProxy provides a JavaScript object interface to raw array data (fields + rows)
 * without creating individual objects for each row. Instead, it uses a single, reusable Proxy
 * object that dynamically maps property access to the current row's data.
 *
 * ## Key Features
 * - **Memory Efficient**: Uses a single proxy object for all iterations, avoiding object allocation per row
 * - **Type Safe**: Provides full TypeScript type safety for field access
 * - **Dual API**: Offers both memory-efficient iteration and convenient materialized methods
 * - **Repeated Iteration**: Supports multiple iterations over the same dataset
 * - **Index-based Access**: Allows random access to specific rows via `at(index)` (returns materialized copies)
 *
 * ## Usage Patterns
 *
 * ### Memory-Efficient Iteration (Recommended for large datasets)
 * ```typescript
 * for (const item of proxy) {
 *   // Process immediately - don't store references
 *   console.log(item.name, item.id);
 * }
 * ```
 *
 * ### Materialized Results (Safe for storage and later use)
 * ```typescript
 * const allItems = proxy.toArray();             // All items as independent objects
 * const filtered = proxy.filter(x => x.active); // Filtered items as independent objects
 * const item = proxy.at(5);                     // Single item as independent object
 * ```
 *
 * ## Performance Characteristics
 * - **Time**: O(1) field access via Map-based lookup
 * - **Space**: O(1) memory overhead regardless of dataset size (excluding the raw data)
 * - **Iteration**: Extremely fast due to proxy reuse and minimal allocations
 *
 * ## Important Notes
 * - Proxy objects from iteration should be used immediately or their data copied
 * - Materialized methods (toArray, filter) create independent objects safe for storage
 * - The same proxy instance is reused across all iterations for memory efficiency
 *
 * @template T The TypeScript interface representing the structure of each row
 */
export class TypedArrayProxy<T extends Record<string, unknown>> implements Iterable<T> {
  private readonly fieldMap: Map<keyof T, number>
  private readonly proxyTarget: Record<string, unknown> = {}
  private readonly proxy: T
  private currentIndex = 0

  private readonly rawResponse: TypedArray<T>

  constructor(rawResponse: TypedArray<T>) {
    this.rawResponse = rawResponse
    // Create a map for O(1) field lookups
    this.fieldMap = new Map(rawResponse.fields.map((field, index) => [field, index]))

    // Create a single proxy that we'll reuse for all iterations
    this.proxy = new Proxy(this.proxyTarget, {
      get: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          const fieldIndex = this.fieldMap.get(prop as keyof T)
          if (fieldIndex !== undefined) {
            const currentRow = this.rawResponse.data[this.currentIndex]
            return currentRow?.[fieldIndex] ?? null
          }
        }
        return target[prop as keyof typeof target] ?? null
      },

      has: (target, prop: string | symbol) => {
        if (typeof prop === 'string') {
          return this.fieldMap.has(prop as keyof T)
        }
        return prop in target
      },

      ownKeys: () => {
        return this.rawResponse.fields as ReadonlyArray<string | symbol>
      },

      getOwnPropertyDescriptor: (target, prop: string | symbol) => {
        if (typeof prop === 'string' && this.fieldMap.has(prop as keyof T)) {
          return {
            enumerable: true,
            configurable: true,
            value: this.proxy[prop as keyof T],
          }
        }
        return Object.getOwnPropertyDescriptor(target, prop)
      },
    }) as T
  }

  /**
   * Create a materialized copy of the item at the specified index.
   * This is the core materialization logic used by at(), toArray(), and filter().
   * Assumes the index is valid - callers must perform boundary checks.
   *
   * @param index - The zero-based index of the item to materialize (must be valid)
   * @returns A materialized copy of the item
   */
  private materializeItem(index: number): T {
    const materialized = {} as T
    const rowData = this.rawResponse.data[index]
    if (!rowData) {
      throw new Error(`No data at index ${index}`)
    }
    for (const field of this.rawResponse.fields) {
      const fieldIndex = this.fieldMap.get(field)
      if (fieldIndex === undefined) {
        throw new Error(`Field ${String(field)} not found in field map`)
      }
      ;(materialized as Record<string, unknown>)[field as string] = rowData[fieldIndex] ?? null
    }
    return materialized
  }

  /**
   * Iterator implementation that yields proxy objects for memory efficiency.
   * Each yielded object is the same proxy instance, reused for all iterations.
   * Process items immediately during iteration or copy their data if needed for later use.
   *
   * @returns Iterator that yields proxy objects representing each row
   */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.rawResponse.data.length; i++) {
      // Set the current index
      this.currentIndex = i

      // Yield the same proxy instance - no new object allocation
      yield this.proxy
    }
  }

  /**
   * Get the total number of items in the response.
   *
   * @returns The number of data rows in the response
   */
  get length(): number {
    return this.rawResponse.data.length
  }

  /**
   * Get a specific item by index as a materialized copy.
   * Returns an independent object that is safe to store and use after the call.
   *
   * @param index - The zero-based index of the item to retrieve
   * @returns A materialized copy of the item at the given index, or undefined if out of bounds
   */
  at(index: number): T | undefined {
    if (index < 0 || index >= this.rawResponse.data.length) {
      return undefined
    }
    return this.materializeItem(index)
  }

  /**
   * Convert all items to a materialized array with independent objects.
   * Each object in the returned array is a separate instance with its own data,
   * safe to store and use after the iterator goes out of scope.
   *
   * @returns Array of materialized objects representing all items
   */
  toArray(): T[] {
    return this.rawResponse.data.map((_, index) => this.materializeItem(index))
    // const result: T[] = []
    // for (let i = 0; i < this.rawResponse.data.length; i++) {
    //   result.push(this.materializeItem(i))
    // }
    // return result
  }

  /**
   * Filter items and return a materialized array of results.
   * Each object in the returned array is a separate instance with its own data,
   * making it safe to use Array.from() or store results for later use.
   *
   * @param predicate - Function to test each item. Return true to include the item in results
   * @returns Array of materialized objects that pass the predicate test
   */
  filter(predicate: (item: T) => boolean): T[] {
    const result: T[] = []
    for (let i = 0; i < this.rawResponse.data.length; i++) {
      this.currentIndex = i
      if (predicate(this.proxy)) {
        result.push(this.materializeItem(i))
      }
    }
    return result
  }

  /**
   * Create an iterator over filtered items using the reusable proxy.
   * This is memory efficient but items should be processed immediately during iteration.
   * Use filter() instead if you need to store results for later use.
   *
   * @param predicate - Function to test each item. Return true to include the item in iteration
   * @returns Generator that yields proxy objects for items that pass the predicate test
   */
  *filteredIterator(predicate: (item: T) => boolean): Generator<T, void, unknown> {
    for (const item of this) {
      if (predicate(item)) {
        yield item
      }
    }
  }
}

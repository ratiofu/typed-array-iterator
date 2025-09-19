# Typed Array Proxy

A memory-efficient, type-safe proxy for iterating over packed arrays representing objects.

TypedArrayProxy provides a JavaScript object interface to raw array data (fields + rows)
without creating individual objects for each row. Instead, it uses a single, reusable Proxy
object that dynamically maps property access to the current row's data.

## Key Features

- **Memory Efficient**: Uses a single proxy object for all iterations, avoiding object allocation per row
- **Type Safe**: Provides full TypeScript type safety for field access
- **Dual API**: Offers both memory-efficient iteration and convenient materialized methods
- **Repeated Iteration**: Supports multiple iterations over the same dataset
- **Index-based Access**: Allows random access to specific rows via `at(index)` (returns materialized copies)

## Usage Patterns

### Memory-Efficient Iteration (Recommended for large datasets)

```typescript
for (const item of proxy) {
  // Process immediately - don't store references
  console.log(item.name, item.id);
}
```

### Materialized Results (Safe for storage and later use)

```typescript
const allItems = proxy.toArray();             // All items as independent objects
const filtered = proxy.filter(x => x.active); // Filtered items as independent objects
const item = proxy.at(5);                     // Single item as independent object
```

## Performance Characteristics

- **Time**: O(1) field access
- **Space**: O(1) memory overhead regardless of dataset size (excluding the raw data)
- **Iteration**: Extremely fast due to proxy reuse and minimal allocations

## Important Notes

- Proxy objects from iteration should be used immediately or their data copied
- Materialized methods (toArray, filter) create independent objects safe for storage
- The same proxy instance is reused across all iterations for memory efficiency

## Prerequisites

**Bun**

```bash
curl https://bun.sh/install | bash
```

## Installation

```bash
bun i
```

## Run Demonstration

```bash
bun src/index.ts
```

**with other fixture data**

TODO:

```bash
bun src/index.ts [path to some_fixture_data.json]
```

## Testing

This project includes comprehensive unit tests with > 95% code coverage.

### Run Tests with Coverage

```bash
bun test
```

## Code Quality

```bash
bun quality
```

## Performance Benchmarks

Run comprehensive performance benchmarks comparing different iteration and filtering methods:

```bash
# Run benchmarks with default dataset (20,000 records)
bun run benchmark

# Run benchmarks with custom record count
bun --expose-gc src/benchmark/index.ts 5000
bun --expose-gc src/benchmark/index.ts 50000
```

The benchmark compares:
- **Direct proxy iteration** vs **toArray() then iterate**
- **filteredIterator()** vs **filter()** methods
- Memory usage and execution time across different dataset sizes

Data is generated in-memory using realistic fake data. Results include detailed timing statistics, memory usage patterns, and visual performance distribution charts.

## Generate More Test Fixture Data

```bash
bun generate-fixtures 1000000 > huge.json
```

## License

MIT

# Typed Array Generator

A memory-efficient, type-safe generator for iterating and filtering arrays
without allocating intermediate objects.

## Key Features

- **Memory Efficient**: Does not re-allocate arrays for each iteration
- **Type Safe**: Provides full TypeScript type safety

## Memory-Efficient Array Iteration, Filtering, 

```typescript
// examples will go here
// filter
// foreach
// map
// reduce
// for...of
// materialize
```

## Performance Characteristics

- **Time**: O(n) for all operations
- **Space**: O(1) memory overhead regardless of dataset size

## Development & Contribution

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

## Testing

This project includes comprehensive unit tests with > 95% code coverage.

### Run Tests with Coverage

```bash
bun test
```

## Code Quality

```bash
bun quality # runs code quality checks and units tests
bun quality:all # quality + example
```

## Performance Benchmarks

Run comprehensive performance benchmarks comparing different iteration and filtering methods:

```bash
# Run benchmarks with default dataset (20,000 records)
bun run benchmark:small
bun run benchmark:medium
bun run benchmark:large

# Run benchmarks with custom record count
bun --expose-gc src/benchmark/index.ts 50000
```

The benchmark compares various iteration and filtering methods between the traditional
approach and using a generator.

Data is generated in-memory using realistic fake data.
Results include detailed timing statistics, memory usage patterns, and visual performance distribution charts.

## Generate More Test Fixture Data

```bash
bun generate-fixtures 1000000 > huge.json
```

## License

MIT

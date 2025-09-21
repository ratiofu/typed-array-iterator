# Typed Array Stream (iterator‑free pipeline builder)

A memory-efficient, type-safe, compiled streams API for building optimal pipelines
over arrays/iterables and executing them via terminal methods.


## Usage

```ts
import { stream } from './src/Stream'

// Build a pipeline, then execute with a terminal (toArray/reduce/...)
const result = stream([1, 2, 3, 4])
  .filter((x) => x % 2 === 0)
  .map((x) => x * 10)
  .toArray()
// -> [20, 40]

// Other terminals
const some = stream([1, 2, 3]).some((x) => x > 2) // true
const every = stream([2, 4]).every((x) => x % 2 === 0) // true
const found = stream(['a', 'bb', 'ccc']).find((s) => s.length === 2) // 'bb'
const reduced = stream([1, 2, 3]).reduce((acc, v) => acc + v, 0) // 6

// Flatten (one level)
const flat = stream([[1, 2], [3]]).flat().toArray() // [1, 2, 3]

// React usage (index fallback for key)
// const items = stream(users)
//   .filter(u => u.active)
//   .map((u, i) => <li key={u.id ?? i}>{u.name}</li>)
```

### Design notes

- Current approach: iterator-free, array-first pipeline executor with nested index loops; for...of only inside flatten when the child is a non-array iterable.
- Previous attempts:
  - Packed array representation: complicated memory/GC behavior and didn’t compose cleanly with flatten; harder to reason about indices and early exits.
  - Iterator-per-op pipeline: flexible but slower for arrays; more allocations and indirection along hot paths, and unnecessary for the primary array→array use case.
- Result: keep a simple pipeline builder API with terminal-only execution, optimized for arrays, with graceful fallback for generic iterables at flatten barriers.
## Terminals (succinct)

- toArray(): materializes to an array
- forEach(fn): applies fn to each output (no return value)
- reduce(reducer, initial?): folds outputs; if initial is omitted, first output is used, throws on empty
- some(pred): true if any output satisfies pred (early-exits)
- every(pred): true if all outputs satisfy pred (early-exits on first failure)
- find(pred): returns first matching output or undefined (early-exits)


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

# Typed Array Stream (iterator‑free pipeline builder)

A memory-efficient, type-safe, compiled streams API for building optimal pipelines
over arrays/iterables and executing them via terminal methods.


## Usage

```ts
import { stream } from './src/Stream'

// Build a pipeline, then execute with a terminal (toArray/reduce/...)
const result = stream([1, 2, 3, 4])
  .filter((x) => x % 2 === 0)
  .transform((x) => x * 10)
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
//   .transform((u, i) => <li key={u.id ?? i}>{u.name}</li>)
```

### Design notes

- Current approach: iterator-free, array-first pipeline executor with nested index loops; for...of only inside flatten when the child is a non-array iterable.
- Previous attempts:
  - Packed array representation: complicated memory/GC behavior and didn’t compose cleanly with flatten; harder to reason about indices and early exits.
  - Iterator-per-op pipeline: flexible but slower for arrays; more allocations and indirection along hot paths, and unnecessary for the primary array→array use case.
- Result: keep a simple pipeline builder API with terminal-only execution, optimized for arrays, with graceful fallback for generic iterables at flatten barriers.

## Current Limitation: range(start > 0) with filters

- Temporary: Using a starting range/drop (e.g., `range(start, end)` with `start > 0`, or `drop(n)`) together with any `filter` in the pipeline will throw at compile-time.
- Why: The current implementation applies the initial skip at the source-level before filters, which does not match the desired post-filter semantics when filters are present.
- Workarounds:
  - Use `take(n)` or `range(0, n)` alongside filters (these are enforced post-filter and work correctly), or
  - Materialize with `slice()` first, then filter (trades memory for correctness), or
  - Move `drop`/`range(start > 0)` to pipelines that do not contain filters.
- Status: See `multi-range-support.md` for the plan to support multiple ranges with correct post-filter semantics efficiently.

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
bun run bench
bun run bench:large # runs with 500,000 records
bun run bench:deep # runs a deep comparison of Bun vs Node performance, using performance counters, with 200,000 records

# Run benchmarks with custom record count
bun --expose-gc ben/bench.ts 50000
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

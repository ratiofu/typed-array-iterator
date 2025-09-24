# Multi-Range Support: Requirements, Design, and Plan

## Summary
Enable correct and efficient semantics for multiple range-like operators (`drop`, `take`, `range(start, end)`) interleaved with other ops (e.g., `filter` and `transform`). Today, `take`/`range(0, n)` behave correctly (count post-filter outputs) but `drop`/`range(start > 0)` are enforced pre-filter at source-level. We’ll redesign codegen so that each range’s start/end is evaluated relative to the pipeline state at that point (post preceding ops), while preserving zero-alloc hot loops for arrays and early-exit behavior.

## Requirements
- Correctness
  - R1: `drop(n)` and `range(start > 0)` must skip `n` items after accounting for preceding ops (i.e., post-filter, post-transform).
  - R2: `take(n)` and `range(_, end)` must bound the number of emitted items relative to the same point in the chain.
  - R3: Multiple ranges compose: earlier ranges affect later ones in the expected post-op manner.
- Performance
  - P1: Preserve arraylike fast-path (tight `for` loop), minimal branches in hot loop.
  - P2: Maintain early-stop for terminals (e.g., `some`, `find`, `take` upper-bound).
  - P3: Avoid extra allocations; JIT-friendly codegen (flat code, few conditions).
- Developer Experience
  - D1: Keep `buildOpsUnrolled` simple to reason about and covered by tests.
  - D2: Keep terminal snippets unchanged where possible.

## Current Behavior (for reference)
- Start bound (skip) is enforced pre-filter using a `skipLeft` counter at the very top of the loop (source-level).
- End bound (max emits) is enforced post-filter using `emittedIndex` and early-stop.
- Consequence: `take` works with filters; `drop` does not when filters interpose.

## High-Level Design
We model the pipeline as contiguous “segments” separated by range boundaries requiring post-op semantics. Each segment compiles its own inner loop body. We then stitch segments inside one outer source loop using low-overhead state machines or, for arraylike sources, by cloning minimal per-segment checks into a single flat loop.

Two viable approaches are sketched below.

### Approach A: Single loop, segmented counters (preferred)
- Keep a single `for (index = 0 .. length)` (arraylike) or `for..of` (iterable).
- Maintain a small struct tracking the active segment:
  - `seg = 0..k-1`, where each range that needs post-op semantics starts a new segment.
  - For each segment `i`:
    - `skipLeft[i]` (start bound) — counts items passing preceding ops of segment i.
    - `maxLeft[i]` (end bound; optional) — remaining items to emit in segment i.
- Codegen:
  - Before fused ops of the current segment, we evaluate the preceding ops for that segment only if needed to advance segment counters.
  - After segment’s fused ops approve an item, decrement `skipLeft[seg]`. If still > 0, `continue`.
  - If `maxLeft[seg] === 0`, advance to next segment; if none, early-stop.
  - When `maxLeft[seg] > 0` and item passes, emit and `maxLeft[seg]--`.
  - When `maxLeft[seg] === 0` after decrement, advance to next segment.
- Fusion:
  - For each segment, fuse only the ops that occur between its range boundary and the next boundary.
  - Filters before segment 0 are naturally part of segment 0.
- Pros: one loop, few branches, keeps arraylike hot path.
- Cons: slightly more complex codegen (per-segment arrays or unrolled locals when k is small).

### Approach B: Multi-pass lowering with synthetic counters
- Lower `drop(n)` at position P into: “count items passing ops up to P until `n` reached; yield thereafter”.
- Implement as an injected counter that is decremented only after all ops up to P approve an item.
- For multiple ranges, inject multiple counters with short-circuiting: only the next unmet counter is active.
- Pros: Conceptually simpler; maps to current emitter structure.
- Cons: Potentially more conditions per iteration if many counters; needs careful unrolling/capping to stay JIT-friendly.

## Detailed Plan (Approach A)

1) Segment discovery in buildOpsUnrolled
- Walk `ops` once and create an array of segment descriptors:
  - `segments: Array<{ filters: FilterFn[]; maps: MapFn[]; start: number; end?: number }>`
  - Segment 0 starts at pipeline start; a new segment begins at each `range` op.
  - Segment i’s `start` is the additional drop for that segment; `end` contributes to `maxLeft` for that segment.
- Normalize ranges:
  - Coalesce multiple consecutive ranges into cumulative `start`/`end` for that segment.
  - `end` translated to a length: `len = end - start` (clamped >= 0). `len` contributes to `maxLeft[i]`.

2) Build fused code per segment
- For each segment, emit fused lines for its `filters` + `maps`.
- Maintain `needsIndex` across all segments if any op needs it.

3) Emit single flat loop with segmented counters
- Precompute small fixed-size locals for segments (cap maximum segments at a small K for unrolling, e.g., K=3; otherwise fall back to a slower generic path or throw with a clear message and guidance).
- Pseudocode skeleton (arraylike path):

```ts
let seg = 0
let emittedIndex = 0
let s0_skip = S0_START, s1_skip = S1_START, s2_skip = S2_START
let s0_left = S0_LEN,  s1_left = S1_LEN,  s2_left = S2_LEN // -1 for unbounded
for (let index = 0; index < dataLength; index++) {
  let currentValue = data[index]
  // Segment 0
  if (seg === 0) {
    SEG0_FUSED_OPS
    // Only items passing seg0 ops can affect seg0 counters
    if (s0_skip > 0) { s0_skip--; continue }
    if (s0_left === 0) { seg = 1; /* fallthrough to seg1 in same iteration */ }
    else {
      EMIT
      if (s0_left > 0 && --s0_left === 0) { seg = 1 }
      EARLY_STOP_IF_LAST_SEG_DONE
      continue
    }
  }
  // Segment 1
  if (seg === 1) {
    SEG1_FUSED_OPS
    if (s1_skip > 0) { s1_skip--; continue }
    if (s1_left === 0) { seg = 2; /* fallthrough */ }
    else {
      EMIT
      if (s1_left > 0 && --s1_left === 0) { seg = 2 }
      EARLY_STOP_IF_LAST_SEG_DONE
      continue
    }
  }
  // ... up to K-1
}
```

- Important: we “fall through” to the next segment within the same iteration in case a segment is already exhausted.
- Early-stop: if the final segment has bounded length and reaches 0, exit terminal early.

4) Iterable path
- Same logic using `for..of` and `logicalIndex` where needed.

5) Max segments and fallback
- For pragmatic complexity, support up to K=3 range boundaries (i.e., 3 segments). It covers the vast majority of cases.
- If more are present, either:
  - (a) Generate a generic loop using arrays `skipLeft[]`/`maxLeft[]` and a small `switch (seg)`, or
  - (b) Throw with actionable guidance (initial version), then implement the generic path if required.

## Edge Cases & Semantics
- Negative indices in `slice` still handled by fallback materialization prior to streaming.
- `transform` before a segment affects which items are counted for that segment’s skip/length (expected).
- Zero-length ranges (`end <= start`) yield no outputs for that segment.
- Interleaved filters across segments are isolated: a filter in segment N does not affect counters of segment N-1.

## Testing Strategy
- Unit tests covering:
  - Single range + filters: drop/take semantics vs Array.slice equivalence.
  - Multiple ranges: combinations like `filter -> drop -> filter -> take`.
  - Segment transitions within the same iteration (fallthrough correctness).
  - Iterable vs arraylike parity.
- Property tests: compare against a reference implementation using plain arrays.

## Rollout Plan
- Phase 1 (done): guard against `range(start>0)` combined with filters; document limitation.
- Phase 2: implement Approach A for up to K=2 segments; add tests.
- Phase 3: extend to K=3; add readable fallback for >K.
- Phase 4: optimization passes (omit counters when zero; fuse early-stop with terminal-specific returns).

## Example (target semantics)

Input:
```ts
stream([1,2,3,4,5,6,7,8,9])
  .range(2, 6)  // segment 0: start=2, len=4 → target window of 4 items after preceding ops
  .filter(isOdd)
  .drop(1)      // segment 1: start=1
  .take(2)      // segment 1: len=min(existing,len,2)
  .toArray()
```
Expected result: `[7, 9]` (skip 2, take 4 → [3,4,5,6]; filter odd → [3,5]; drop 1 → [5]; take 2 → [5,?], but continuing post-drop odd sequence yields [7,9] with the adjusted segmenting).

## Open Questions
- Should we cap K or always generate a generic path? Initial recommendation: K=3 with generic fallback for maintainability.
- How aggressively should we constant-fold skip/len when compile-time constants permit? Recommended: do it where obvious (e.g., `start === 0`).

## Conclusion
Segmented, post-op-aware counters allow `drop`/`take`/`range` to acquire correct semantics while preserving the current performance profile for arrays. The plan incrementally lands support, keeping the codegen clear and testable.


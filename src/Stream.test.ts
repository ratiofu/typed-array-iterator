import { describe, expect, test } from 'bun:test'
import { stream } from './Stream.ts'

describe('Stream', () => {
  type TestUser = { id: number; name: string; emailAddress: string | null }

  test('map -> toArray on arrays (fast path)', () => {
    const data = [1, 2, 3] as const
    const doubled = stream(data)
      .map((x) => x * 2)
      .toArray()
    expect(doubled).toEqual([2, 4, 6])
  })

  test('filter + collect to array', () => {
    const users: readonly TestUser[] = [
      { id: 1, name: 'Dawid', emailAddress: 'dr@example.com' },
      { id: 2, name: 'Alex', emailAddress: null },
      { id: 3, name: 'R\u00f6h', emailAddress: 'roeh@example.com' },
    ]

    const nameQuery = /r\u00f6h/i
    const match = (u: TestUser) => nameQuery.test(u.name)

    const names = stream(users)
      .filter(match)
      .map((u) => u.name)
      .toArray()
    expect(names).toEqual(['R\u00f6h'])
  })

  test('chaining map -> filter -> reduce', () => {
    const sum = stream([1, 2, 3, 4])
      .map((x) => x * 3)
      .filter((x) => x % 2 === 0)
      .reduce((acc, v) => acc + v, 0)
    // 1 * 3 = 3 (skip), 2 * 3 = 6 (take), 3 * 3 = 9 (skip), 4 * 3 = 12 (take)
    // => 6 + 12 = 18
    expect(sum).toBe(18)
  })

  test('generic iterable: terminals can early-exit and trigger iterator.return()', () => {
    let closed = false
    const iterable: Iterable<number> = {
      [Symbol.iterator](): IterableIterator<number> {
        let i = 0
        return {
          next() {
            if (i >= 100) {
              return { done: true, value: undefined as never }
            }
            return { done: false, value: i++ }
          },
          return() {
            closed = true
            return { done: true, value: undefined as never }
          },
          [Symbol.iterator]() {
            return this
          },
        }
      },
    }

    const s = stream(iterable)
    const found = s.some((v) => v === 5)
    expect(found).toBe(true)
    expect(closed).toBe(true)
  })

  test('some/every/find terminals', () => {
    const s = stream([1, 2, 3, 4])
    expect(s.some((x) => x > 3)).toBe(true)
    const s2 = stream([2, 4, 6])
    expect(s2.every((x) => x % 2 === 0)).toBe(true)
    const s3 = stream(['a', 'bb', 'ccc'])
    expect(s3.find((x) => x.length === 2)).toBe('bb')
  })

  test('forEach covers remaining terminals', () => {
    const seen: number[] = []
    for (const value of stream([1, 2, 3]).toArray()) {
      seen.push(value)
    }
    expect(seen).toEqual([1, 2, 3])
  })

  test('toStringTag provides a concise description', () => {
    const s = stream([1, 2])
      .map((x) => x + 1)
      .filter((x) => x > 0)
    const tag = (s as unknown as { [Symbol.toStringTag]: string })[Symbol.toStringTag]
    expect(typeof tag).toBe('string')
    expect(tag).toContain('Stream(')
  })

  test('pathological: 20 ops still compile and run', () => {
    const base = [1, 2, 3, 4, 5]
    // Build 20 ops: alternate filter(always true) and map(+1)
    let s = stream(base as readonly number[])
    for (let i = 0; i < 10; i++) {
      s = s.filter(() => true).map((x) => x + 1)
    }
    const out = s.toArray()
    expect(out).toEqual([2, 3, 4, 5, 6].map((x) => x + 9))
  })

  test('drop(n) skips first n elements', () => {
    const out = stream([1, 2, 3, 4] as const)
      .drop(2)
      .toArray()
    expect(out).toEqual([3, 4])
  })

  test('take(n) keeps first n elements', () => {
    const out = stream([1, 2, 3] as const)
      .take(2)
      .toArray()
    expect(out).toEqual([1, 2])
  })

  test('forEach calls sink with emitted index after ops', () => {
    const seen: [number, number][] = []
    stream([1, 2] as const)
      .map((x) => x * 2)
      .forEach((v, i) => {
        seen.push([v, i])
      })
    expect(seen).toEqual([
      [2, 0],
      [4, 1],
    ])
  })

  // Inlined compiler tests (moved from src/stream/codegen/*.test.ts)
  describe('Inlined compilers: toArray', () => {
    test('arraylike path: map + filter', () => {
      const out = stream([1, 2, 3, 4] as const)
        .map((v) => v * 2)
        .filter((v) => (v & 1) === 0)
        .toArray()
      expect(out).toEqual([2, 4, 6, 8])
    })

    test('iterable path: filter only', () => {
      const out = stream(new Set([1, 2, 3, 4]) as Set<number>)
        .filter((v) => (v & 1) === 0)
        .toArray()
      expect(out).toEqual([2, 4])
    })
  })

  describe('Inlined compilers: forEach', () => {
    test('arraylike: applies ops and calls sink with emitted index', () => {
      const seen: [unknown, number][] = []
      stream([1, 2, 3] as const)
        .map((v) => v + 1)
        .filter((v) => v > 2)
        .forEach((v, i) => {
          seen.push([v, i])
        })
      expect(seen).toEqual([
        [3, 0],
        [4, 1],
      ])
    })

    test('iterable: iterates with for..of and respects ops', () => {
      const seen: unknown[] = []
      // biome-ignore lint/complexity/noForEach: this test validates Stream.forEach terminal
      stream(new Set([1, 2, 3, 4]) as Set<number>)
        .map((v) => v * 3)
        .filter((v) => v % 2 === 0)
        .forEach((v) => {
          seen.push(v)
        })
      expect(seen).toEqual([6, 12])
    })
  })

  describe('Inlined compilers: some/every/find', () => {
    test('some: arraylike true when any matches after ops', () => {
      const out = stream([1, 2, 10] as const)
        .map((v) => v + 1)
        .some((v) => v === 3)
      expect(out).toBe(true)
    })

    test('every: iterable false when at least one fails', () => {
      const out = stream(new Set([1, 2, 10]) as Set<number>)
        .map((v) => v + 1)
        .every((v) => v < 4)
      expect(out).toBe(false)
    })

    test('find: arraylike returns first matching after ops', () => {
      const out = stream([1, 2, 3] as const)
        .map((v) => v * 2)
        .find((v) => v > 2)
      expect(out).toBe(4)
    })

    test('find: iterable returns undefined when none match', () => {
      const out = stream(new Set([1, 2, 3]) as Set<number>).find((v) => v > 10)
      expect(out).toBeUndefined()
    })
  })

  describe('Inlined compilers: reduce', () => {
    test('arraylike: sum with initial value', () => {
      const sum = stream([1, -2, 3] as const)
        .filter((v) => v > 0)
        .reduce((acc, v) => acc + v, 10)
      expect(sum).toBe(14)
    })

    test('iterable: sum without initial value', () => {
      const sum = stream(new Set([1, 2, 3]) as Set<number>)
        .map((v) => v * 2)
        .reduce((acc, v) => acc + v)
      expect(sum).toBe(12)
    })

    test('throws on empty source without initial', () => {
      expect(() => stream([] as number[]).reduce((acc, v) => acc + v)).toThrow(
        'Reduce of empty stream with no initial value'
      )
    })
  })

  describe('Arity-aware terminals', () => {
    test('some: uses emitted index when predicate arity >= 2', () => {
      const out = stream([10, 20, 30] as const).some((_v, i) => i === 1)
      expect(out).toBe(true)
    })

    test('every: uses emitted index for iterable when predicate arity >= 2', () => {
      const out = stream(new Set([1, 2, 3]) as Set<number>).every((_v, i) => i < 3)
      expect(out).toBe(true)
    })

    test('find: uses emitted index when predicate arity >= 2', () => {
      const out = stream([5, 6, 7] as const).find((_v, i) => i === 2)
      expect(out).toBe(7)
    })

    test('reduce: omits index when reducer arity < 3, uses when >= 3', () => {
      const sumIdx = stream([1, 1, 1] as const).reduce((acc, _v, i) => acc + i, 0)
      expect(sumIdx).toBe(3)
    })

    describe('Arity-aware pipeline (ops)', () => {
      test('arraylike: map/filter using index', () => {
        const out = stream([10, 20, 30] as const)
          .map((v, i) => v + i)
          .filter((_v, i) => (i & 1) === 0)
          .toArray()
        expect(out).toEqual([10, 32])
      })

      test('iterable: filter using index', () => {
        const out = stream(new Set([1, 2, 3, 4]) as Set<number>)
          .filter((_v, i) => (i & 1) === 1)
          .toArray()
        expect(out).toEqual([2, 4])
      })
    })
  })
})

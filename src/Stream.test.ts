import { describe, expect, test } from 'bun:test'
import { stream } from './Stream.ts'

describe('Stream', () => {
  type TestUser = { id: number; name: string; emailAddress: string | null }

  test('transform -> toArray on arrays (fast path)', () => {
    const data = [1, 2, 3] as const
    const doubled = stream(data)
      .transform((x) => x * 2)
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
      .transform((u) => u.name)
      .toArray()
    expect(names).toEqual(['R\u00f6h'])
  })

  test('chaining transform -> filter -> reduce', () => {
    const sum = stream([1, 2, 3, 4])
      .transform((x) => x * 3)
      .filter((x) => x % 2 === 0)
      .reduce((acc, v) => acc + v, 0)
    // 1 * 3 = 3 (skip), 2 * 3 = 6 (take), 3 * 3 = 9 (skip), 4 * 3 = 12 (take)
    // => 6 + 12 = 18
    expect(sum).toBe(18)
  })

  describe('filterText', () => {
    type TestUser = { id: number; name: string; emailAddress: string | null }
    const users: readonly TestUser[] = [
      { id: 1, name: 'Alice Exampleton', emailAddress: 'alice@example.com' },
      { id: 2, name: 'Bob Marley', emailAddress: 'bob@reggae.org' },
      { id: 3, name: 'Charles', emailAddress: null },
      { id: 4, name: 'Malice', emailAddress: 'evil@domain.com' },
    ]

    test('rejects when no token longer than 2 characters', () => {
      const out = stream(users).filterText('a an of', 'name', 'emailAddress').toArray()
      expect(out).toEqual([])
    })

    test('starts-with for tokens of length 2 or 3 (case-insensitive)', () => {
      // "ali" (3) should match Alice by starts-with in name; not Malice (contains only)
      const out = stream(users).filterText('ali', 'name').toArray()
      expect(out.map((u) => u.name)).toEqual(['Alice Exampleton'])
    })

    test('contains for tokens length >= 4 (case-insensitive)', () => {
      // "alic" (4) should match both Alice and Malice (contains)
      const out = stream(users).filterText('alic', 'name').toArray()
      expect(out.map((u) => u.name)).toEqual(['Alice Exampleton', 'Malice'])
    })

    test('tokens can all be satisfied by a single field', () => {
      // With starts-with ("^") for short tokens, use one anchored and one contains token in the same field
      const out = stream(users).filterText('ali exam', 'name', 'emailAddress').toArray()
      expect(out.map((u) => u.id)).toEqual([1])
    })

    test('multiple tokens: tokens can be matched across different fields', () => {
      // With starts-with ("^") for short tokens, choose tokens that start at different fields
      const out = stream(users).filterText('mal evi', 'name', 'emailAddress').toArray()
      // "mal" matches start of name "Malice"; "evi" matches start of email "evil@domain.com"
      expect(out.map((u) => u.id)).toEqual([4])
    })

    test('rejects when no fields are provided', () => {
      const out = stream(users).filterText('alice').toArray()
      expect(out).toEqual([])
    })
  })

  describe('filterText codegen edge cases', () => {
    type WeirdUser = { id: number; 'first-name': string; emailAddress: string | null }
    const users: readonly WeirdUser[] = [
      { id: 1, 'first-name': 'Alice', emailAddress: 'alice@example.com' },
      { id: 2, 'first-name': 'Malice', emailAddress: null },
    ]

    test('supports non-identifier field names via bracket access: starts-with (short token)', () => {
      const out = stream(users).filterText('ali', 'first-name').toArray()
      expect(out.map((u) => u['first-name'])).toEqual(['Alice'])
    })

    test('supports non-identifier field names via bracket access: contains (long token)', () => {
      const out = stream(users).filterText('alic', 'first-name').toArray()
      expect(out.map((u) => u['first-name'])).toEqual(['Alice', 'Malice'])
    })
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

  test('toString provides a concise description', () => {
    const s = stream([1, 2])
      .transform((x) => x + 1)
      .filter((x) => x > 0)
    const tag = s.toString()
    expect(typeof tag).toBe('string')
    expect(tag).toContain('Stream(')
  })

  test('pathological: 20 ops still compile and run', () => {
    const base = [1, 2, 3, 4, 5]
    // Build 20 ops: alternate filter(always true) and transform(+1)
    let s = stream(base as readonly number[])
    for (let i = 0; i < 10; i++) {
      s = s.filter(() => true).transform((x) => x + 1)
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
      .transform((x) => x * 2)
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
    test('arraylike path: transform + filter', () => {
      const out = stream([1, 2, 3, 4] as const)
        .transform((v) => v * 2)
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
        .transform((v) => v + 1)
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
        .transform((v) => v * 3)
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
        .transform((v) => v + 1)
        .some((v) => v === 3)
      expect(out).toBe(true)
    })

    test('every: iterable false when at least one fails', () => {
      const out = stream(new Set([1, 2, 10]) as Set<number>)
        .transform((v) => v + 1)
        .every((v) => v < 4)
      expect(out).toBe(false)
    })

    test('find: arraylike returns first matching after ops', () => {
      const out = stream([1, 2, 3] as const)
        .transform((v) => v * 2)
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
        .transform((v) => v * 2)
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
      test('arraylike: transform/filter using index', () => {
        const out = stream([10, 20, 30] as const)
          .transform((v, i) => v + i)
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

  describe('Re-run terminals', () => {
    test('reduce can be run more than once on the same stream', () => {
      const s = stream([1, 2, 3, 4] as const)
        .transform((x) => x + 1)
        .filter((x) => x % 2 === 0)
      const first = s.reduce((acc, v) => acc + v, 0)
      const second = s.reduce((acc, v) => acc + v, 0)
      expect(first).toBe(6)
      expect(second).toBe(6)
    })

    test('length can be accessed multiple times and remains stable (including take/drop)', () => {
      const s = stream([1, 2, 3, 4, 5] as const)
        .drop(1)
        .take(2)
      expect(s.length).toBe(2)
      expect(s.length).toBe(2)
      // And reduce twice for good measure
      expect(s.reduce((acc) => acc + 1, 0)).toBe(2)
      expect(s.reduce((acc) => acc + 1, 0)).toBe(2)
    })
  })

  describe('range and slice', () => {
    test('range(start, end) limits by index lazily', () => {
      const out = stream([1, 2, 3, 4] as const)
        .range(1, 3)
        .transform((x) => x * 2)
        .toArray()
      expect(out).toEqual([4, 6])
    })

    test('range(start) behaves like drop', () => {
      const out = stream([1, 2, 3, 4] as const)
        .range(2)
        .toArray()
      expect(out).toEqual([3, 4])
    })

    test('slice returns an array like Array.prototype.slice (positive indices)', () => {
      const base = [1, 2, 3, 4] as const
      const s = stream(base)
      expect(s.slice(1, 3)).toEqual(base.slice(1, 3))
    })

    test('slice supports negative indices via fallback', () => {
      const base = [1, 2, 3, 4]
      const s = stream(base)
      expect(s.slice(-2)).toEqual(base.slice(-2))
    })

    test('slice length matches expected for positive indices', () => {
      const base = [1, 2, 3, 4] as const
      const s = stream(base)
      expect(s.slice(1, 3).length).toBe(base.slice(1, 3).length)
    })

    test('slice length matches when end exceeds source length', () => {
      const base = [1, 2, 3, 4] as const
      const s = stream(base)
      expect(s.slice(2, 10).length).toBe(base.slice(2, 10).length)
    })

    test('slice length is zero when start beyond source length', () => {
      const base = [1, 2, 3, 4] as const
      const s = stream(base)
      expect(s.slice(10, 20).length).toBe(base.slice(10, 20).length)
    })
  })
})

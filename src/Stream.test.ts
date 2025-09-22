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
})

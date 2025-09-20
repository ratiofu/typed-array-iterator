import { describe, expect, test } from 'bun:test'
import { Stream, stream } from './Stream.ts'

describe('Stream', () => {
  type TestUser = { id: number; name: string; emailAddress: string | null }

  test('map -> toArray on arrays (fast path)', () => {
    const data = [1, 2, 3] as const
    const doubled = stream(data)
      .map((x) => x * 2)
      .toArray()
    expect(doubled).toEqual([2, 4, 6])
  })

  test('filter in for...of (single-use iterator)', () => {
    const users: readonly TestUser[] = [
      { id: 1, name: 'Dawid', emailAddress: 'dr@example.com' },
      { id: 2, name: 'Alex', emailAddress: null },
      { id: 3, name: 'R\u00f6h', emailAddress: 'roeh@example.com' },
    ]

    const nameQuery = /r\u00f6h/i
    const match = (u: TestUser) => nameQuery.test(u.name)

    const names: string[] = []
    for (const u of stream(users).filter(match)) {
      names.push(u.name)
    }

    expect(names).toEqual(['R\u00f6h'])
  })

  test('single-use enforcement: throws when consumed twice', () => {
    const s = stream([1, 2, 3])
    expect(s.toArray()).toEqual([1, 2, 3])
    expect(() => s.toArray()).toThrow('Stream already consumed')
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

  test('generic iterable fallback and early return cleanup', () => {
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

    const s = new Stream(iterable)
    let seen = 0
    for (const v of s) {
      if (v === 5) {
        break // trigger early termination -> should call return()
      }
      seen++
    }
    expect(seen).toBe(5)
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

  test('iterator protocol: next/return/throw on array fast path', () => {
    const s = stream([1, 2])
    const it = s[Symbol.iterator]()
    // iterator is self-iterable
    expect(it[Symbol.iterator]()).toBe(it)
    expect(it.next()).toEqual({ done: false, value: 1 })
    // return should end iteration
    const r = it.return?.()
    expect(r?.done).toBe(true)
    // throw should bubble when upstream has no throw()
    expect(() => s.throw(new Error('boom'))).toThrow('boom')
  })

  test('Stream.next() delegating to fused iterator', () => {
    const s = stream([10, 20])
    expect(s.next()).toEqual({ done: false, value: 10 })
    expect(s.next()).toEqual({ done: false, value: 20 })
    expect(s.next().done).toBe(true)
  })

  test('generic fused iterator is self-iterable and return() path', () => {
    const iterable: Iterable<number> = {
      [Symbol.iterator](): IterableIterator<number> {
        let i = 0
        return {
          next() {
            return i < 2 ? { done: false, value: i++ } : { done: true, value: undefined as never }
          },
          return() {
            return { done: true, value: undefined as never }
          },
          [Symbol.iterator]() {
            return this
          },
        }
      },
    }
    const s = stream(iterable)
    const it = s[Symbol.iterator]()
    expect(it[Symbol.iterator]()).toBe(it)
    expect(it.next()).toEqual({ done: false, value: 0 })
    expect(it.return?.().done).toBe(true)
  })

  test('forEach covers remaining terminals', () => {
    const seen: number[] = []
    for (const value of stream([1, 2, 3])) {
      seen.push(value)
    }
    expect(seen).toEqual([1, 2, 3])
  })

  test('flatMap flattens a single level', () => {
    const res = stream([1, 2])
      .flatMap((x) => [x, x + 10])
      .toArray()
    expect(res).toEqual([1, 11, 2, 12])
  })

  test('multiple flatMap operations are allowed and compose', () => {
    const res = stream([1, 2])
      .flatMap((x) => [[x, x + 1], [x + 10]])
      .flatten()
      .toArray()
    expect(res).toEqual([1, 2, 11, 2, 3, 12])
  })

  test('operators after flatten apply to flattened elements', () => {
    const res = stream([1, 2])
      .flatMap((x) => [x, x + 10])
      .map((y) => y * 2)
      .toArray()
    expect(res).toEqual([2, 22, 4, 24])
  })

  test('flatten iterator wrapper is self-iterable and supports return()', () => {
    const s = stream([[1], [2]]).flatten()
    const it = s[Symbol.iterator]()
    expect(it[Symbol.iterator]()).toBe(it)
    const first = it.next()
    expect(first).toEqual({ done: false, value: 1 })
    const r = it.return?.()
    expect(r?.done).toBe(true)
  })

  test('toStringTag provides a concise description', () => {
    const s = stream([1, 2])
      .map((x) => x + 1)
      .filter((x) => x > 0)
    const tag = (s as unknown as { [Symbol.toStringTag]: string })[Symbol.toStringTag]
    expect(typeof tag).toBe('string')
    expect(tag).toContain('Stream(')
  })
})

import { describe, expect, test } from 'bun:test'
import { stream } from '../Stream.ts'

describe('DebugStream', () => {
  test('toArray(): returns generated function source', () => {
    const s = stream([1, 2, 3] as const).transform((x) => x + 1)
    const src = s.debug().toArray()
    console.log(src)
    expect(typeof src).toBe('string')
    expect(src).toContain('function anonymous(')
    expect(src).toContain('result.length = emittedIndex')
  })

  test('some() with iterable and arity>=2 includes logicalIndex plumbing', () => {
    const s = stream(new Set([1, 2, 3]) as Set<number>).transform((x) => x * 2)
    const src = s.debug().some((_v: number, _i: number) => true)
    console.log(src)
    // Iterable path with needsIndex uses logicalIndex
    expect(src).toContain('let logicalIndex = 0')
    expect(src).toContain('const index = logicalIndex++')
  })

  test('filterText debug header shows regexes and compiled body', () => {
    const users = [
      { id: 1, name: 'Alice', emailAddress: 'alice@example.com' },
      { id: 2, name: 'Malice', emailAddress: 'evil@domain.com' },
    ] as const

    const s = stream(
      users as readonly { id: number; name: string; emailAddress: string | null }[]
    ).filterText('alic evil', 'name', 'emailAddress')

    const src = s
      .debug()
      .some((u: { id: number; name: string; emailAddress: string | null }) => !!u)
    console.log(src)
    expect(src).toContain('regexes=[')
    expect(src).toMatch(/\/alic\/i/)
    expect(src).toMatch(/\/evil\/i/)
    expect(src).toContain('compiled: {')
  })
})

test('forEach(): noResults path returns minimal stub', () => {
  const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ] as const
  // notSpecificEnough: single-char token => compiles to noMatch filter
  const src = stream(users)
    .filterText('a', 'name')
    .debug()
    .forEach((_v: unknown, _i: number) => {
      // non-empty body to satisfy linter; body is irrelevant for DebugStream
      return
    })
  expect(src).toContain('/*\n    Debug forEach: noResults\n  */')
  expect(src).toContain('return')
})

test('reduce(): header includes terminal reducer and initialValue', () => {
  const s = stream([1, 2, 3] as const).transform((x) => x * 2)
  const src = s.debug().reduce((a: number, b: number) => a + b, 10)
  expect(src).toContain('  /*\n    Debug reduce:')
  expect(src).toContain('    terminal:')
  expect(src).toContain('    - reducer:')
  expect(src).toContain('    - initialValue: 10')
})

test('every(): noResults path returns minimal stub', () => {
  const s = stream([{ name: 'a' }] as const).filterText('a', 'name')
  const src = s.debug().every(() => true)
  expect(src).toContain('  /*\n    Debug every: noResults\n  */')
  expect(src).toContain('return false')
})

test('find(): noResults path returns minimal stub', () => {
  const s = stream([{ name: 'a' }] as const).filterText('a', 'name')
  const src = s.debug().find(() => true)
  expect(src).toContain('  /*\n    Debug find: noResults\n  */')
  expect(src).toContain('return undefined')
})

test('count(): header and body are present (arrayLike path)', () => {
  const s = stream([1, 2, 3] as const)
    .transform((x) => x + 1)
    .filter((x) => x > 1)
  const src = s.debug().count()
  expect(src).toContain('  /*\n    Debug count:')
  expect(src).toContain('arrayLike: true')
  expect(src).toContain('emittedIndex++')
})

test('header includes ops with user function names and sources', () => {
  const s = stream([1, 2, 3] as const)
    .transform((x) => x + 1)
    .filter((x) => x > 2)
  const src = s.debug().toArray()
  expect(src).toContain('ops:')
  // Built names from compiler: filter1, map1
  expect(src).toContain('- filter1:')
  expect(src).toContain('- map1:')
})

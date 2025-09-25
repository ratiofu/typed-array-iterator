import { describe, expect, it } from 'bun:test'
import type { FixtureModel } from '../fixtures/FixtureModel'
import { manualSearch } from './manualSearch'

const data: FixtureModel[] = [
  { id: 1, name: 'Alice', emailAddress: 'alice@example.com' },
  { id: 2, name: 'Bob', emailAddress: 'bob@example.com' },
  { id: 3, name: 'Eve', emailAddress: 'evil@example.com' },
]

describe('manualSearch (smoke)', () => {
  it('returns matches for a simple multi-token query', () => {
    const out = manualSearch(data, 'ali exam')
    expect(out.some((u) => u.name === 'Alice')).toBe(true)
  })

  it('returns empty when query not specific enough', () => {
    const out = manualSearch(data, 'a b')
    expect(out.length).toBe(0)
  })
})

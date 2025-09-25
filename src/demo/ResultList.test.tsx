import { describe, expect, it } from 'bun:test'
import { renderToString } from 'react-dom/server'
import type { FixtureModel } from '../fixtures/FixtureModel'
import { ResultList } from './ResultList'

const items: FixtureModel[] = [
  { id: 1, name: 'Alice', emailAddress: 'alice@example.com' },
  { id: 2, name: 'Bob', emailAddress: 'bob@example.com' },
]

describe('ResultList (smoke)', () => {
  it('renders with highlighted tokens', () => {
    const tokens = ['ali', 'exa']
    const html = renderToString(<ResultList shownItems={items} tokens={tokens} />)
    expect(html).toContain('<ul')
    expect(html).toContain('<mark>Ali</mark>')
    expect(html).toContain('@<mark>exa</mark>mple.com')
  })
})

import { beforeEach, describe, expect, it } from 'bun:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { setupLocalStorageMock } from '../testutils/setupLocalStorageMock'
import { App } from './App'

let store: Map<string, string>

beforeEach(() => {
  store = setupLocalStorageMock()
  // Keep the demo light in tests
  store.set('fixtureSize', JSON.stringify(10))
})

describe('App (smoke)', () => {
  it('server-renders without crashing and includes headings', () => {
    const html = renderToString(React.createElement(App))
    expect(html).toContain('Stream Text Search Demo')
    expect(html).toContain('Search Results')
  })
})

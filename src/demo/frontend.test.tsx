import { beforeEach, describe, expect, it } from 'bun:test'
import '../../happydom'
import { setupLocalStorageMock } from '../testutils/setupLocalStorageMock'

let store: Map<string, string>

beforeEach(() => {
  store = setupLocalStorageMock()
  store.set('fixtureSize', JSON.stringify(5))
  // Ensure a clean body before each run
  document.body.innerHTML = ''
})

describe('frontend (smoke)', () => {
  it('attaches the app to an existing root without crashing', async () => {
    // Pre-create root to keep this test deterministic
    const el = document.createElement('div')
    el.id = 'root'
    document.body.appendChild(el)

    await import('./frontend')
    const root = document.getElementById('root') as HTMLDivElement | null
    expect(root).toBeTruthy()
  })
})

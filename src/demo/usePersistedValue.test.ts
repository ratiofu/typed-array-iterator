import { beforeEach, describe, expect, it } from 'bun:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { setupLocalStorageMock } from '../testutils/setupLocalStorageMock'
import { usePersistedValue } from './usePersistedValue'

// Helper test component to run the hook during server-render
function TestComponent<T>(props: {
  storageKey: string
  initial: T
  transform?: (v: unknown) => T
  capture: (v: T) => void
}) {
  const [value] = usePersistedValue<T>(props.storageKey, props.initial, props.transform)
  // Capture value during render (okay for this test)
  props.capture(value)
  return React.createElement('div', null)
}

let store: Map<string, string>

beforeEach(() => (store = setupLocalStorageMock()))

describe('usePersistedValue', () => {
  it('returns initial value and persists it when no prior value exists', () => {
    let captured: number | undefined

    renderToString(
      React.createElement(TestComponent<number>, {
        storageKey: 'k1',
        initial: 123,
        capture: (v) => (captured = v),
      })
    )

    expect(captured).toBe(123)
    expect(store.get('k1')).toBe(JSON.stringify(123))
  })

  it('reads and parses an existing persisted JSON value', () => {
    // Pre-populate storage with an object
    store.set('k2', JSON.stringify({ a: 1 }))

    let captured: { a: number } | undefined

    renderToString(
      React.createElement(TestComponent<{ a: number }>, {
        storageKey: 'k2',
        initial: { a: -1 },
        capture: (v) => (captured = v),
      })
    )

    expect(captured).toEqual({ a: 1 })
    // Also ensure it was written back as a string
    expect(store.get('k2')).toBe(JSON.stringify({ a: 1 }))
  })

  it('applies transform when provided', () => {
    // Persisted raw value is a string "5"; transform turns it into a number+1 => 6
    store.set('k3', JSON.stringify('5'))

    let captured: number | undefined

    renderToString(
      React.createElement(TestComponent<number>, {
        storageKey: 'k3',
        initial: 0,
        transform: (v) => Number(v) + 1,
        capture: (v) => (captured = v),
      })
    )

    expect(captured).toBe(6)
    expect(store.get('k3')).toBe(JSON.stringify(6))
  })

  it('falls back to initial value if persisted JSON is null', () => {
    store.set('k4', JSON.stringify(null))

    let captured: string | undefined

    renderToString(
      React.createElement(TestComponent<string>, {
        storageKey: 'k4',
        initial: 'default',
        capture: (v) => (captured = v),
      })
    )

    expect(captured).toBe('default')
    expect(store.get('k4')).toBe(JSON.stringify('default'))
  })
})

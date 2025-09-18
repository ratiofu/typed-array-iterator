import { describe, expect, test } from 'bun:test'
import { buildLookup, type FieldLookupStrategy } from './FieldLookupStrategy'

interface TestRecord {
  id: number
  name: string
  email: string
}

describe('FieldLookupStrategy', () => {
  describe('buildLookup with map strategy', () => {
    test('should return a function that correctly maps field names to indices', () => {
      const fields: Array<keyof TestRecord> = ['id', 'name', 'email']
      const lookupFn = buildLookup<TestRecord>('map', fields)

      expect(lookupFn('id')).toBe(0)
      expect(lookupFn('name')).toBe(1)
      expect(lookupFn('email')).toBe(2)
    })

    test('should return undefined for non-existent fields', () => {
      const fields: Array<keyof TestRecord> = ['id', 'name', 'email']
      const lookupFn = buildLookup<TestRecord>('map', fields)

      expect(lookupFn('nonexistent' as keyof TestRecord)).toBeUndefined()
    })

    test('should handle empty fields array', () => {
      const fields: Array<keyof TestRecord> = []
      const lookupFn = buildLookup<TestRecord>('map', fields)

      expect(lookupFn('id')).toBeUndefined()
      expect(lookupFn('name')).toBeUndefined()
      expect(lookupFn('email')).toBeUndefined()
    })

    test('should handle single field', () => {
      const fields: Array<keyof TestRecord> = ['name']
      const lookupFn = buildLookup<TestRecord>('map', fields)

      expect(lookupFn('name')).toBe(0)
      expect(lookupFn('id')).toBeUndefined()
      expect(lookupFn('email')).toBeUndefined()
    })

    test('should handle duplicate field names (last occurrence wins)', () => {
      const fields = ['name', 'id', 'name'] as Array<keyof TestRecord>
      const lookupFn = buildLookup<TestRecord>('map', fields)

      // Map behavior: last occurrence overwrites previous
      expect(lookupFn('name')).toBe(2)
      expect(lookupFn('id')).toBe(1)
    })

    test('should work with different field orders', () => {
      const fields: Array<keyof TestRecord> = ['email', 'id', 'name']
      const lookupFn = buildLookup<TestRecord>('map', fields)

      expect(lookupFn('email')).toBe(0)
      expect(lookupFn('id')).toBe(1)
      expect(lookupFn('name')).toBe(2)
    })
  })

  describe('buildLookup error handling', () => {
    test('should throw error for unknown strategy', () => {
      const fields: Array<keyof TestRecord> = ['id', 'name', 'email']

      expect(() => {
        buildLookup('unknown' as FieldLookupStrategy, fields)
      }).toThrow('Unknown field lookup strategy: unknown')
    })
  })

  describe('buildLookup function consistency', () => {
    test('should return consistent results across multiple calls', () => {
      const fields: Array<keyof TestRecord> = ['id', 'name', 'email']
      const lookupFn1 = buildLookup<TestRecord>('map', fields)
      const lookupFn2 = buildLookup<TestRecord>('map', fields)

      // Different function instances but same behavior
      expect(lookupFn1).not.toBe(lookupFn2)
      expect(lookupFn1('id')).toBe(lookupFn2('id'))
      expect(lookupFn1('name')).toBe(lookupFn2('name'))
      expect(lookupFn1('email')).toBe(lookupFn2('email'))
      expect(lookupFn1('nonexistent' as keyof TestRecord)).toBe(
        lookupFn2('nonexistent' as keyof TestRecord)
      )
    })

    test('should handle repeated lookups correctly', () => {
      const fields: Array<keyof TestRecord> = ['id', 'name', 'email']
      const lookupFn = buildLookup<TestRecord>('map', fields)

      // Multiple calls should return same results
      expect(lookupFn('name')).toBe(1)
      expect(lookupFn('name')).toBe(1)
      expect(lookupFn('name')).toBe(1)

      expect(lookupFn('nonexistent' as keyof TestRecord)).toBeUndefined()
      expect(lookupFn('nonexistent' as keyof TestRecord)).toBeUndefined()
    })
  })
})

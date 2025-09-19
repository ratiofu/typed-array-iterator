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

  describe('buildLookup with switch strategy', () => {
    test('should return a function that correctly maps field names to indices', () => {
      const fields: Array<keyof TestRecord> = ['id', 'name', 'email']
      const lookupFn = buildLookup<TestRecord>('switch', fields)

      expect(lookupFn('id')).toBe(0)
      expect(lookupFn('name')).toBe(1)
      expect(lookupFn('email')).toBe(2)
    })

    test('should return undefined for non-existent fields', () => {
      const fields: Array<keyof TestRecord> = ['id', 'name', 'email']
      const lookupFn = buildLookup<TestRecord>('switch', fields)

      expect(lookupFn('nonexistent' as keyof TestRecord)).toBeUndefined()
    })

    test('should handle empty fields array', () => {
      const fields: Array<keyof TestRecord> = []
      const lookupFn = buildLookup<TestRecord>('switch', fields)

      expect(lookupFn('id')).toBeUndefined()
      expect(lookupFn('name')).toBeUndefined()
      expect(lookupFn('email')).toBeUndefined()
    })

    test('should handle single field', () => {
      const fields: Array<keyof TestRecord> = ['name']
      const lookupFn = buildLookup<TestRecord>('switch', fields)

      expect(lookupFn('name')).toBe(0)
      expect(lookupFn('id')).toBeUndefined()
      expect(lookupFn('email')).toBeUndefined()
    })

    test('should handle duplicate field names (last occurrence wins)', () => {
      const fields = ['name', 'id', 'name'] as Array<keyof TestRecord>
      const lookupFn = buildLookup<TestRecord>('switch', fields)

      // Switch behavior: last occurrence overwrites previous (same as map)
      expect(lookupFn('name')).toBe(2)
      expect(lookupFn('id')).toBe(1)
    })

    test('should work with different field orders', () => {
      const fields: Array<keyof TestRecord> = ['email', 'id', 'name']
      const lookupFn = buildLookup<TestRecord>('switch', fields)

      expect(lookupFn('email')).toBe(0)
      expect(lookupFn('id')).toBe(1)
      expect(lookupFn('name')).toBe(2)
    })

    test('should handle fields with special characters', () => {
      interface SpecialRecord {
        'field-with-dash': string
        'field with space': string
        'field.with.dots': string
        'field"with"quotes': string
      }

      const fields: Array<keyof SpecialRecord> = [
        'field-with-dash',
        'field with space',
        'field.with.dots',
        'field"with"quotes',
      ]
      const lookupFn = buildLookup<SpecialRecord>('switch', fields)

      expect(lookupFn('field-with-dash')).toBe(0)
      expect(lookupFn('field with space')).toBe(1)
      expect(lookupFn('field.with.dots')).toBe(2)
      expect(lookupFn('field"with"quotes')).toBe(3)
    })

    test('should generate a function with switch statement', () => {
      const fields: Array<keyof TestRecord> = ['id', 'name', 'email']
      const lookupFn = buildLookup<TestRecord>('switch', fields)

      // Verify it's actually a function
      expect(typeof lookupFn).toBe('function')

      // Verify the function source contains switch statement
      const functionSource = lookupFn.toString()
      expect(functionSource).toContain('switch')
      expect(functionSource).toContain('case "id"')
      expect(functionSource).toContain('case "name"')
      expect(functionSource).toContain('case "email"')
      expect(functionSource).toContain('return 0')
      expect(functionSource).toContain('return 1')
      expect(functionSource).toContain('return 2')
      expect(functionSource).toContain('default')
      expect(functionSource).toContain('return undefined')
    })
  })

  describe('buildLookup strategy comparison', () => {
    test('map and switch strategies should produce identical results', () => {
      const fields: Array<keyof TestRecord> = ['id', 'name', 'email']
      const mapLookup = buildLookup<TestRecord>('map', fields)
      const switchLookup = buildLookup<TestRecord>('switch', fields)

      // Test all valid fields
      expect(mapLookup('id')).toBe(switchLookup('id'))
      expect(mapLookup('name')).toBe(switchLookup('name'))
      expect(mapLookup('email')).toBe(switchLookup('email'))

      // Test invalid field
      expect(mapLookup('nonexistent' as keyof TestRecord)).toBe(
        switchLookup('nonexistent' as keyof TestRecord)
      )
    })

    test('both strategies should handle edge cases identically', () => {
      const emptyFields: Array<keyof TestRecord> = []
      const mapEmpty = buildLookup<TestRecord>('map', emptyFields)
      const switchEmpty = buildLookup<TestRecord>('switch', emptyFields)

      expect(mapEmpty('id')).toBe(switchEmpty('id'))
      expect(mapEmpty('name')).toBe(switchEmpty('name'))

      const singleField: Array<keyof TestRecord> = ['name']
      const mapSingle = buildLookup<TestRecord>('map', singleField)
      const switchSingle = buildLookup<TestRecord>('switch', singleField)

      expect(mapSingle('name')).toBe(switchSingle('name'))
      expect(mapSingle('id')).toBe(switchSingle('id'))
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

import { beforeEach, describe, expect, test } from 'bun:test'
import type { TypedArray } from './TypedArray'
import { TypedArrayProxy } from './TypedArrayProxy.ts'

describe('TypedArrayProxy', () => {
  // Type definitions for test data
  type TestUser = { id: number; name: string; emailAddress: string }
  type TestProduct = { productId: string; title: string; price: number; inStock: boolean }

  describe('with 0 records (empty dataset)', () => {
    let emptyResponse: TypedArray<TestUser>
    let iterator: TypedArrayProxy<TestUser>

    beforeEach(() => {
      emptyResponse = {
        fields: ['id', 'name', 'emailAddress'],
        data: [],
      }
      iterator = new TypedArrayProxy<TestUser>(emptyResponse)
    })

    test('should have length of 0', () => {
      expect(iterator.length).toBe(0)
    })

    test('should not yield any items when iterated', () => {
      const items = Array.from(iterator)
      expect(items).toEqual([])
    })

    test('should return undefined for any index access', () => {
      expect(iterator.at(0)).toBeUndefined()
      expect(iterator.at(-1)).toBeUndefined()
      expect(iterator.at(1)).toBeUndefined()
    })

    test('should handle for...of loop correctly', () => {
      const items: TestUser[] = []
      for (const item of iterator) {
        items.push(item)
      }
      expect(items).toEqual([])
    })

    test('should handle spread operator correctly', () => {
      const items = [...iterator]
      expect(items).toEqual([])
    })
  })

  describe('with 1 record', () => {
    let singleResponse: TypedArray<TestUser>
    let iterator: TypedArrayProxy<TestUser>

    beforeEach(() => {
      singleResponse = {
        fields: ['id', 'name', 'emailAddress'],
        data: [[1001, 'Alice', 'alice@example.com']],
      }
      iterator = new TypedArrayProxy<TestUser>(singleResponse)
    })

    test('should have length of 1', () => {
      expect(iterator.length).toBe(1)
    })

    test('should yield exactly one item when iterated', () => {
      const items: TestUser[] = []
      for (const item of iterator) {
        // Process items immediately during iteration
        items.push({
          id: item.id,
          name: item.name,
          emailAddress: item.emailAddress,
        })
      }

      expect(items).toHaveLength(1)
      expect(items[0]?.id).toBe(1001)
      expect(items[0]?.name).toBe('Alice')
      expect(items[0]?.emailAddress).toBe('alice@example.com')
    })

    test('should return the item at index 0', () => {
      const user = iterator.at(0)
      expect(user).toBeDefined()
      expect(user?.id).toBe(1001)
      expect(user?.name).toBe('Alice')
      expect(user?.emailAddress).toBe('alice@example.com')
    })

    test('should return undefined for out-of-bounds indices', () => {
      expect(iterator.at(1)).toBeUndefined()
      expect(iterator.at(-1)).toBeUndefined()
      expect(iterator.at(10)).toBeUndefined()
    })

    test('should handle for...of loop correctly', () => {
      const items: TestUser[] = []
      for (const item of iterator) {
        items.push({ ...item } as TestUser)
      }

      expect(items).toHaveLength(1)
      expect(items[0]?.id).toBe(1001)
      expect(items[0]?.name).toBe('Alice')
      expect(items[0]?.emailAddress).toBe('alice@example.com')
    })

    test('should reuse the same proxy object for efficiency', () => {
      let firstItem: TestUser | undefined
      let secondItem: TestUser | undefined

      // First iteration
      // noinspection LoopStatementThatDoesntLoopJS
      for (const item of iterator) {
        firstItem = item
        break
      }

      // Second iteration
      // noinspection LoopStatementThatDoesntLoopJS
      for (const item of iterator) {
        secondItem = item
        break
      }

      // Should be the same proxy object reference
      expect(firstItem).toBe(secondItem)
    })

    test('should handle property existence checks', () => {
      const user = iterator.at(0)
      expect(user).toBeDefined()
      if (user) {
        expect('id' in user).toBe(true)
        expect('name' in user).toBe(true)
        expect('emailAddress' in user).toBe(true)
        expect('nonExistentField' in user).toBe(false)
      }
    })

    test('should return undefined for non-existent fields (materialized objects)', () => {
      const user = iterator.at(0)
      expect(user).toBeDefined()
      if (user) {
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript's index signature check
        expect((user as Record<string, unknown>)['nonExistentField']).toBe(undefined)
      }
    })

    test('should handle Object.keys() correctly', () => {
      const user = iterator.at(0)
      expect(user).toBeDefined()
      if (user) {
        const keys = Object.keys(user)
        expect(keys).toEqual(['id', 'name', 'emailAddress'])
      }
    })

    test('should handle symbol property checks in proxy', () => {
      const sym = Symbol('test')

      // Test symbol property access via proxy (during iteration)
      // noinspection LoopStatementThatDoesntLoopJS
      for (const item of iterator) {
        expect(sym in item).toBe(false)
        break
      }
    })

    test('at() should return materialized copies, not proxy references', () => {
      const firstItem = iterator.at(0)
      const secondItem = iterator.at(0)

      // Should be different object instances (materialized copies)
      expect(firstItem).not.toBe(secondItem)

      // But should have the same data
      expect(firstItem).toEqual(secondItem)
      expect(firstItem?.id).toBe(secondItem?.id)
      expect(firstItem?.name).toBe(secondItem?.name)
      expect(firstItem?.emailAddress).toBe(secondItem?.emailAddress)
    })
  })

  describe('with 4 records', () => {
    let multiResponse: TypedArray<TestProduct>
    let iterator: TypedArrayProxy<TestProduct>

    beforeEach(() => {
      multiResponse = {
        fields: ['productId', 'title', 'price', 'inStock'],
        data: [
          ['P001', 'Laptop', 999.99, true],
          ['P002', 'Mouse', 29.99, false],
          ['P003', 'Keyboard', 79.99, true],
          ['P004', 'Monitor', 299.99, true],
        ],
      }
      iterator = new TypedArrayProxy<TestProduct>(multiResponse)
    })

    test('should have length of 4', () => {
      expect(iterator.length).toBe(4)
    })

    test('should yield all 4 items when iterated', () => {
      const items: TestProduct[] = []
      for (const item of iterator) {
        // Process items immediately during iteration
        items.push({
          productId: item.productId,
          title: item.title,
          price: item.price,
          inStock: item.inStock,
        })
      }

      expect(items).toHaveLength(4)

      expect(items[0]?.productId).toBe('P001')
      expect(items[0]?.title).toBe('Laptop')
      expect(items[0]?.price).toBe(999.99)
      expect(items[0]?.inStock).toBe(true)

      expect(items[3]?.productId).toBe('P004')
      expect(items[3]?.title).toBe('Monitor')
      expect(items[3]?.price).toBe(299.99)
      expect(items[3]?.inStock).toBe(true)
    })

    test('should return correct items for all valid indices', () => {
      expect(iterator.at(0)?.productId).toBe('P001')
      expect(iterator.at(1)?.productId).toBe('P002')
      expect(iterator.at(2)?.productId).toBe('P003')
      expect(iterator.at(3)?.productId).toBe('P004')
    })

    test('should return undefined for out-of-bounds indices', () => {
      expect(iterator.at(4)).toBeUndefined()
      expect(iterator.at(-1)).toBeUndefined()
      expect(iterator.at(100)).toBeUndefined()
    })

    test('should handle for...of loop correctly with all items', () => {
      const productIds: string[] = []
      for (const product of iterator) {
        productIds.push(product.productId)
      }

      expect(productIds).toEqual(['P001', 'P002', 'P003', 'P004'])
    })

    test('should handle multiple iterations correctly', () => {
      const firstIteration: string[] = []
      for (const product of iterator) {
        firstIteration.push(product.productId)
      }

      const secondIteration: string[] = []
      for (const product of iterator) {
        secondIteration.push(product.productId)
      }

      expect(firstIteration).toEqual(['P001', 'P002', 'P003', 'P004'])
      expect(secondIteration).toEqual(['P001', 'P002', 'P003', 'P004'])
    })

    test('should maintain proxy state correctly during iteration', () => {
      const iterator1 = new TypedArrayProxy<TestProduct>(multiResponse)
      const iterator2 = new TypedArrayProxy<TestProduct>(multiResponse)

      // Get items from different iterators
      const item1 = iterator1.at(0)
      const item2 = iterator2.at(2)

      expect(item1?.productId).toBe('P001')
      expect(item2?.productId).toBe('P003')

      // Verify they don't interfere with each other
      expect(item1?.productId).toBe('P001') // Should still be P001
    })

    test('should handle mixed data types correctly', () => {
      const product = iterator.at(0)
      expect(product).toBeDefined()
      if (product) {
        expect(typeof product.productId).toBe('string')
        expect(typeof product.title).toBe('string')
        expect(typeof product.price).toBe('number')
        expect(typeof product.inStock).toBe('boolean')
      }
    })

    test('should handle property enumeration correctly', () => {
      const product = iterator.at(0)
      expect(product).toBeDefined()
      if (product) {
        const keys = Object.keys(product)
        expect(keys).toEqual(['productId', 'title', 'price', 'inStock'])

        const descriptors = Object.getOwnPropertyDescriptors(product)
        expect(Object.keys(descriptors)).toEqual(['productId', 'title', 'price', 'inStock'])
      }
    })

    test('should handle filtering and mapping operations', () => {
      const inStockProducts: TestProduct[] = []
      for (const product of iterator) {
        if (product.inStock) {
          inStockProducts.push({
            productId: product.productId,
            title: product.title,
            price: product.price,
            inStock: product.inStock,
          })
        }
      }

      expect(inStockProducts).toHaveLength(3)
      expect(inStockProducts.map((p) => p.productId)).toEqual(['P001', 'P003', 'P004'])

      const prices: number[] = []
      for (const product of iterator) {
        prices.push(product.price)
      }
      expect(prices).toEqual([999.99, 29.99, 79.99, 299.99])
    })

    test('should allow repeated iteration with consistent behavior', () => {
      // First iteration - process items immediately
      const firstResults: string[] = []
      for (const product of iterator) {
        firstResults.push(`${product.productId}:${product.title}`)
      }

      // Second iteration - process items immediately
      const secondResults: string[] = []
      for (const product of iterator) {
        secondResults.push(`${product.productId}:${product.title}`)
      }

      expect(firstResults).toEqual(['P001:Laptop', 'P002:Mouse', 'P003:Keyboard', 'P004:Monitor'])

      expect(secondResults).toEqual(['P001:Laptop', 'P002:Mouse', 'P003:Keyboard', 'P004:Monitor'])
    })

    test('should handle null values in data', () => {
      const responseWithNulls: TypedArray<TestProduct> = {
        fields: ['productId', 'title', 'price', 'inStock'],
        data: [
          ['P001', null as unknown as string, 999.99, true],
          [null as unknown as string, 'Mouse', null as unknown as number, false],
        ],
      }

      const nullIterator = new TypedArrayProxy<TestProduct>(responseWithNulls)

      // Test first item
      const firstItem = nullIterator.at(0)
      expect(firstItem).toBeDefined()
      if (firstItem) {
        expect(firstItem.productId).toBe('P001')
        expect(firstItem.title).toBe(null as unknown as string)
        expect(firstItem.price).toBe(999.99)
        expect(firstItem.inStock).toBe(true)
      }

      // Test second item
      const secondItem = nullIterator.at(1)
      expect(secondItem).toBeDefined()
      if (secondItem) {
        expect(secondItem.productId).toBe(null as unknown as string)
        expect(secondItem.title).toBe('Mouse')
        expect(secondItem.price).toBe(null as unknown as number)
        expect(secondItem.inStock).toBe(false)
      }
    })
  })

  describe('materialization methods', () => {
    type TestPerson = { id: number; name: string; active: boolean }
    type TestScore = { id: number; name: string; score: number }
    type TestItem = { id: number; name: string; category: string }

    test('toArray() should return materialized objects that remain valid', () => {
      const response: TypedArray<TestPerson> = {
        fields: ['id', 'name', 'active'],
        data: [
          [1, 'Alice', true],
          [2, 'Bob', false],
          [3, 'Charlie', true],
        ],
      }

      const iterator = new TypedArrayProxy<TestPerson>(response)
      const materialized = iterator.toArray()

      expect(materialized).toHaveLength(3)

      // All items should be independent objects
      expect(materialized[0]).not.toBe(materialized[1])
      expect(materialized[1]).not.toBe(materialized[2])

      // Data should be correct
      expect(materialized[0]?.id).toBe(1)
      expect(materialized[0]?.name).toBe('Alice')
      expect(materialized[0]?.active).toBe(true)

      expect(materialized[2]?.id).toBe(3)
      expect(materialized[2]?.name).toBe('Charlie')
      expect(materialized[2]?.active).toBe(true)

      // Items should remain valid even after more operations on the iterator
      iterator.at(0) // This no longer affects proxy state since at() returns materialized copies
      expect(materialized[1]?.id).toBe(2) // Should still be Bob's data
      expect(materialized[1]?.name).toBe('Bob')
      expect(materialized[1]?.active).toBe(false)
    })

    test('filter() should return materialized filtered results', () => {
      const response: TypedArray<TestPerson> = {
        fields: ['id', 'name', 'active'],
        data: [
          [1, 'Alice', true],
          [2, 'Bob', false],
          [3, 'Charlie', true],
          [4, 'Diana', false],
        ],
      }

      const iterator = new TypedArrayProxy<TestPerson>(response)
      const activeUsers = iterator.filter((user) => user.active)

      expect(activeUsers).toHaveLength(2)

      // Should be materialized objects
      expect(activeUsers[0]).not.toBe(activeUsers[1])

      // Should have correct data
      expect(activeUsers[0]?.id).toBe(1)
      expect(activeUsers[0]?.name).toBe('Alice')
      expect(activeUsers[0]?.active).toBe(true)

      expect(activeUsers[1]?.id).toBe(3)
      expect(activeUsers[1]?.name).toBe('Charlie')
      expect(activeUsers[1]?.active).toBe(true)

      // Results should remain valid after iterator operations
      iterator.at(2) // This no longer affects proxy state since at() returns materialized copies
      expect(activeUsers[0]?.name).toBe('Alice') // Should still be Alice
    })

    test('filteredIterator() should return proxy objects for memory efficiency', () => {
      const response: TypedArray<TestScore> = {
        fields: ['id', 'name', 'score'],
        data: [
          [1, 'Alice', 85],
          [2, 'Bob', 92],
          [3, 'Charlie', 78],
          [4, 'Diana', 95],
        ],
      }

      const iterator = new TypedArrayProxy<TestScore>(response)

      const highScorers: TestScore[] = []
      for (const user of iterator.filteredIterator((user) => user.score >= 90)) {
        // Process immediately and copy data
        highScorers.push({
          id: user.id,
          name: user.name,
          score: user.score,
        })
      }

      expect(highScorers).toHaveLength(2)
      expect(highScorers[0]?.name).toBe('Bob')
      expect(highScorers[0]?.score).toBe(92)
      expect(highScorers[1]?.name).toBe('Diana')
      expect(highScorers[1]?.score).toBe(95)
    })

    test('Array.from() should work correctly with filter() results', () => {
      const response: TypedArray<TestItem> = {
        fields: ['id', 'name', 'category'],
        data: [
          [1, 'Apple', 'fruit'],
          [2, 'Carrot', 'vegetable'],
          [3, 'Banana', 'fruit'],
          [4, 'Broccoli', 'vegetable'],
        ],
      }

      const iterator = new TypedArrayProxy<TestItem>(response)

      // This should work correctly now since filter() returns materialized objects
      const fruits = Array.from(iterator.filter((item) => item.category === 'fruit'))

      expect(fruits).toHaveLength(2)
      expect(fruits[0]?.name).toBe('Apple')
      expect(fruits[1]?.name).toBe('Banana')

      // All items should be independent
      expect(fruits[0]).not.toBe(fruits[1])
    })
  })

  describe('FieldLookupStrategy integration', () => {
    type TestUser = { id: number; name: string; emailAddress: string }

    test('should work with map strategy (default)', () => {
      const response: TypedArray<TestUser> = {
        fields: ['id', 'name', 'emailAddress'],
        data: [[1, 'Alice', 'alice@example.com']],
      }

      const iterator = new TypedArrayProxy<TestUser>(response, 'map')
      const user = iterator.at(0)

      expect(user).toBeDefined()
      expect(user?.id).toBe(1)
      expect(user?.name).toBe('Alice')
      expect(user?.emailAddress).toBe('alice@example.com')
    })

    test('should work with switch strategy', () => {
      const response: TypedArray<TestUser> = {
        fields: ['id', 'name', 'emailAddress'],
        data: [[1, 'Alice', 'alice@example.com']],
      }

      const iterator = new TypedArrayProxy<TestUser>(response, 'switch')
      const user = iterator.at(0)

      expect(user).toBeDefined()
      expect(user?.id).toBe(1)
      expect(user?.name).toBe('Alice')
      expect(user?.emailAddress).toBe('alice@example.com')
    })

    test('both strategies should produce identical results', () => {
      const response: TypedArray<TestUser> = {
        fields: ['id', 'name', 'emailAddress'],
        data: [
          [1, 'Alice', 'alice@example.com'],
          [2, 'Bob', 'bob@example.com'],
          [3, 'Charlie', 'charlie@example.com'],
        ],
      }

      const mapIterator = new TypedArrayProxy<TestUser>(response, 'map')
      const switchIterator = new TypedArrayProxy<TestUser>(response, 'switch')

      // Test at() method
      for (let i = 0; i < response.data.length; i++) {
        const mapUser = mapIterator.at(i)
        const switchUser = switchIterator.at(i)

        expect(mapUser).toEqual(switchUser)
      }

      // Test iteration
      const mapResults: TestUser[] = []
      const switchResults: TestUser[] = []

      for (const user of mapIterator) {
        mapResults.push({ ...user })
      }

      for (const user of switchIterator) {
        switchResults.push({ ...user })
      }

      expect(mapResults).toEqual(switchResults)
    })

    test('switch strategy should handle property access during iteration', () => {
      const response: TypedArray<TestUser> = {
        fields: ['id', 'name', 'emailAddress'],
        data: [
          [1, 'Alice', 'alice@example.com'],
          [2, 'Bob', 'bob@example.com'],
        ],
      }

      const iterator = new TypedArrayProxy<TestUser>(response, 'switch')
      const results: string[] = []

      for (const user of iterator) {
        // Test property access with switch strategy
        results.push(`${user.id}:${user.name}:${user.emailAddress}`)
      }

      expect(results).toEqual(['1:Alice:alice@example.com', '2:Bob:bob@example.com'])
    })

    test('switch strategy should handle non-existent field access', () => {
      const response: TypedArray<TestUser> = {
        fields: ['id', 'name', 'emailAddress'],
        data: [[1, 'Alice', 'alice@example.com']],
      }

      const iterator = new TypedArrayProxy<TestUser>(response, 'switch')
      const user = iterator.at(0)

      expect(user).toBeDefined()
      if (user) {
        // Test accessing non-existent field
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript's index signature check
        expect((user as Record<string, unknown>)['nonExistentField']).toBe(undefined)
      }
    })

    test('switch strategy should handle Object.keys() correctly', () => {
      const response: TypedArray<TestUser> = {
        fields: ['id', 'name', 'emailAddress'],
        data: [[1, 'Alice', 'alice@example.com']],
      }

      const iterator = new TypedArrayProxy<TestUser>(response, 'switch')
      const user = iterator.at(0)

      expect(user).toBeDefined()
      if (user) {
        const keys = Object.keys(user)
        expect(keys).toEqual(['id', 'name', 'emailAddress'])
      }
    })

    test('switch strategy should handle property existence checks', () => {
      const response: TypedArray<TestUser> = {
        fields: ['id', 'name', 'emailAddress'],
        data: [[1, 'Alice', 'alice@example.com']],
      }

      const iterator = new TypedArrayProxy<TestUser>(response, 'switch')

      // Test during iteration (proxy object)
      // noinspection LoopStatementThatDoesntLoopJS
      for (const user of iterator) {
        expect('id' in user).toBe(true)
        expect('name' in user).toBe(true)
        expect('emailAddress' in user).toBe(true)
        expect('nonExistentField' in user).toBe(false)
        break
      }
    })
  })

  describe('edge cases and error handling', () => {
    type TestName = { id: number; name: string }
    // Note: some type hacking here is necessary!

    test('should handle empty fields array', () => {
      const emptyFieldsResponse: TypedArray<Record<string, never>> = {
        fields: [],
        data: [[1 as unknown as never, 2 as unknown as never, 3 as unknown as never]],
      }

      const iterator = new TypedArrayProxy(emptyFieldsResponse)
      expect(iterator.length).toBe(1)

      const item = iterator.at(0)
      expect(item).toBeDefined()
      if (item) {
        expect(Object.keys(item)).toEqual([])
      }
    })

    test('should handle mismatched field count and data columns', () => {
      const mismatchedResponse: TypedArray<TestName> = {
        fields: ['id', 'name'],
        data: [[1, 'Alice', 'extra_data']],
      }

      const iterator = new TypedArrayProxy<TestName>(mismatchedResponse)
      const item = iterator.at(0)
      expect(item).toBeDefined()
      if (item) {
        expect(item.id).toBe(1)
        expect(item.name).toBe('Alice')
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript's index signature check
        expect((item as Record<string, unknown>)['extra_data']).toBe(undefined) // Field not in
        // fields array (materialized object)
      }
    })

    test('should handle fewer data columns than fields', () => {
      const incompleteResponse: TypedArray<TestUser> = {
        fields: ['id', 'name', 'emailAddress'],
        data: [[1, 'Alice']], // Missing email
      }

      const iterator = new TypedArrayProxy<TestUser>(incompleteResponse)
      const item = iterator.at(0)
      expect(item).toBeDefined()
      if (item) {
        expect(item.id).toBe(1)
        expect(item.name).toBe('Alice')
        // Missing data should return null
        expect(item.emailAddress).toBe(null as unknown as string)
      }
    })
  })
})

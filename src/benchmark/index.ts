#!/usr/bin/env bun

import { bench, run as mitataRun } from 'mitata'
import { generateFixtureData } from '../generateFixtureData'
import type { TypedArray } from '../TypedArray'
import { TypedArrayProxy } from '../TypedArrayProxy'
import type { FixtureModel } from './FixtureModel'
import { formatNumber } from './format'

// Test predicate: users with names longer than 10 characters
const longNameFilter = (user: FixtureModel) => user.name.length > 10

// Test consumer: simple operation to prevent optimization
let consumedCount = 0
const consumeUser = (user: FixtureModel) => {
  consumedCount += user.id
}

function setupBenchmarks(data: TypedArray<FixtureModel>) {
  const typedArrayJson = JSON.stringify(data)
  const traditionalArrayOfObjects = new TypedArrayProxy(data, 'switch').toArray()
  const traditionalJson = JSON.stringify(traditionalArrayOfObjects)
  const strategies = ['map', 'switch'] as const

  global.gc?.() // force garbage collection after data setup

  bench('traditionally deserialized array iteration', () => {
    const array: FixtureModel[] = JSON.parse(traditionalJson)
    consumedCount = 0
    // conversion to materialized object array to estimate the extra
    // "deserialization cost" of allocating all the objects
    for (const user of array) {
      consumeUser(user)
    }
  })

  bench('filter traditionally deserialized array', () => {
    const array: FixtureModel[] = JSON.parse(traditionalJson)
    consumedCount = 0
    for (const user of array.filter(longNameFilter)) {
      consumeUser(user)
    }
  })

  for (const strategy of strategies) {
    bench(`[${strategy}] proxy iteration`, () => {
      const deserialized: TypedArray<FixtureModel> = JSON.parse(typedArrayJson)
      const proxy = new TypedArrayProxy(deserialized, strategy)
      consumedCount = 0
      for (const user of proxy) {
        consumeUser(user)
      }
    })
  }

  for (const strategy of strategies) {
    bench(`[${strategy}] filtered iteration`, () => {
      const deserialized: TypedArray<FixtureModel> = JSON.parse(typedArrayJson)
      const proxy = new TypedArrayProxy(deserialized, strategy)
      consumedCount = 0
      for (const user of proxy.filteredIterator(longNameFilter)) {
        consumeUser(user)
      }
    })
  }

  for (const strategy of strategies) {
    bench(`[${strategy}] filter to materialized array`, () => {
      const deserialized: TypedArray<FixtureModel> = JSON.parse(typedArrayJson)
      const proxy = new TypedArrayProxy(deserialized, strategy)
      consumedCount = 0
      const filtered = proxy.filter(longNameFilter)
      for (const user of filtered) {
        consumeUser(user)
      }
    })
  }
}

function printDataStats(data: TypedArray<FixtureModel>) {
  console.log(`        Fields: ${data.fields.join(', ')}`)
  const serialized = JSON.stringify(data)
  console.log(`   Packed Size: ${formatNumber(serialized.length)} UTF-8 characters`)
  const gzipped = globalThis.Bun.gzipSync(serialized, { level: 9, windowBits: 31 })
  console.log(`Packed Gzipped: ${formatNumber(gzipped.length)}B`)
  const traditionalArrayOfObjects = new TypedArrayProxy(data, 'switch').toArray()
  const json = JSON.stringify(traditionalArrayOfObjects)
  console.log(`     JSON Size: ${formatNumber(json.length)} UTF-8 characters`)
  const gzippedJson = globalThis.Bun.gzipSync(serialized, { level: 9, windowBits: 31 })
  console.log(`  JSON Gzipped: ${formatNumber(gzippedJson.length)}B`)
}

export async function runBenchmarks(recordCount = 20000) {
  console.log('\n🚀  TypedArrayProxy Performance Benchmarks')
  console.log(`\n⏳  Generating ${recordCount.toLocaleString()} records`)
  const data = generateFixtureData(recordCount)
  printDataStats(data)
  global.gc?.() // force garbage collection after data generation

  setupBenchmarks(data as TypedArray<FixtureModel>)
  console.log('🏃  Running benchmarks...\n')
  await mitataRun({ colors: true })
  console.log(`\n∑ Total operations: ${consumedCount.toLocaleString()}`)
}

// Run benchmarks if this file is executed directly
if (import.meta.main) {
  // Check for command line argument for record count
  const args = process.argv.slice(2)
  const recordCount = args[0] ? parseInt(args[0], 10) : 20000

  if (Number.isNaN(recordCount) || recordCount <= 0) {
    console.error('Error: Record count must be a positive integer')
    console.error('Usage: bun src/benchmark/index.ts [recordCount]')
    console.error('Example: bun src/benchmark/index.ts 5000')
    process.exit(1)
  }

  runBenchmarks(recordCount).catch(console.error)
}

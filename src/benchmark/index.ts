#!/usr/bin/env bun

import { bench, group, run as mitataRun } from 'mitata'
import { generateFixtureData } from '../generateFixtureData'
import type { TypedArray } from '../TypedArray'
import { TypedArrayProxy } from '../TypedArrayProxy'
import type { FixtureModel } from './FixtureModel'

// Test predicate: users with names longer than 10 characters
const longNameFilter = (user: FixtureModel) => user.name.length > 10

// Test consumer: simple operation to prevent optimization
let consumedCount = 0
const consumeUser = (user: FixtureModel) => {
  consumedCount += user.id
}

function setupBenchmarks(data: TypedArray<FixtureModel>) {
  const proxy = new TypedArrayProxy<FixtureModel>(data)
  group('Filtering Comparison', () => {
    bench('filteredIterator() - memory efficient', () => {
      consumedCount = 0
      for (const user of proxy.filteredIterator(longNameFilter)) {
        consumeUser(user)
      }
    })

    bench('filter() - materialized results', () => {
      consumedCount = 0
      const filtered = proxy.filter(longNameFilter)
      for (const user of filtered) {
        consumeUser(user)
      }
    })
  })

  group('Iteration Comparison', () => {
    bench('Direct proxy iteration', () => {
      consumedCount = 0
      for (const user of proxy) {
        consumeUser(user)
      }
    })

    bench('toArray() then iterate', () => {
      consumedCount = 0
      const array = proxy.toArray()
      for (const user of array) {
        consumeUser(user)
      }
    })
  })
}

async function runBenchmarks(recordCount = 20000) {
  console.log('\n🚀  TypedArrayProxy Performance Benchmarks')

  console.log(`\n⏳  Generating ${recordCount.toLocaleString()} records`)
  // Generate data in memory
  const data = generateFixtureData(recordCount)
  console.log(`📊  Fields: ${data.fields.join(', ')}`)

  // Force garbage collection after data generation
  global.gc?.()

  setupBenchmarks(data as TypedArray<FixtureModel>)

  console.log('🏃  Running benchmarks...\n')

  // Run all benchmarks
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

export { runBenchmarks }

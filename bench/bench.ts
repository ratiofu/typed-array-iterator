#!/usr/bin/env bun

import { barplot, bench, run as mitataRun } from 'mitata'
import type { FixtureModel } from '../src/fixtures/FixtureModel'
import { generateFixtureData } from '../src/fixtures/generateFixtureData'
import { stream } from '../src/Stream'

// Test predicate: users with names longer than 10 characters
const longNameFilter = (user: FixtureModel) => user.name.length > 10

// Test consumer: simple operation to prevent optimization
let nameCount = 0
function countNames(name: string) {
  nameCount += name.length
}

function setupBenchmarks(data: readonly FixtureModel[]) {
  global.gc?.() // force garbage collection after data setup

  barplot(() => {
    // Flat data scenario (no nested arrays)
    bench('custom stream: filter->map->forEach', () => {
      nameCount = 0
      stream(data)
        .filter(longNameFilter)
        .map((user) => user.name)
        .forEach(countNames)
    })

    bench('arrays: filter->map->forEach', () => {
      nameCount = 0
      data
        .filter(longNameFilter)
        .map((user) => user.name)
        .forEach(countNames)
    })

    bench('manual loop: filter->map->forEach (equivalent)', () => {
      nameCount = 0
      for (let i = 0; i < data.length; i++) {
        const u = data[i]
        if (u && longNameFilter(u)) {
          countNames(u.name)
        }
      }
    })
  })

  barplot(() => {
    // single operation scenario
    bench('custom stream: single operation', () => {
      nameCount = 0
      // biome-ignore lint/complexity/noForEach: this is done here on purpose
      stream(data).forEach((it) => {
        countNames(it.name)
      })
    })

    bench('arrays: single operation', () => {
      nameCount = 0
      // biome-ignore lint/complexity/noForEach: this is done here on purpose
      data.forEach((it) => {
        countNames(it.name)
      })
    })

    bench('manual loop: single operation', () => {
      nameCount = 0
      for (let i = 0; i < data.length; i++) {
        const u = data[i]
        if (u) {
          countNames(u.name)
        }
      }
    })
  })

  // Text filtering comparison: stream.filterText vs arrays vs manual loop
  {
    const query = 'gmail com'

    const escapeRegexLiteral = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    barplot(() => {
      bench('text filter: custom stream.filterText (end-to-end)', () => {
        nameCount = 0
        // Compile per-iteration to measure end-to-end cost
        const filtered = stream(data).filterText(query, 'name', 'emailAddress')
        // biome-ignore lint/complexity/noForEach: for-each is the only way to get the data
        filtered.forEach((u) => {
          countNames(u.name)
        })
      })

      bench('text filter: arrays filter->forEach (end-to-end)', () => {
        nameCount = 0
        // Rebuild tokens/regexes and predicate per-iteration to measure end-to-end cost
        const tokens2 = query.split(/\s+/).filter((t) => t.length > 0)
        const regexes2 = tokens2.map(
          (t) => new RegExp((t.length < 4 ? '^' : '') + escapeRegexLiteral(t), 'i')
        )
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: end-to-end bench predicate
        const arraysPredicate2 = (u: FixtureModel) => {
          const v1u = u.name
          const v2u = u.emailAddress
          const v1 = typeof v1u === 'string' ? v1u : ''
          const v2 = typeof v2u === 'string' ? v2u : ''
          for (const re of regexes2) {
            if (!(re.test(v1) || re.test(v2))) return false
          }
          return true
        }
        // biome-ignore lint/complexity/noForEach: comparing to stream.forEach
        data.filter(arraysPredicate2).forEach((u) => {
          countNames(u.name)
        })
      })
    })
  }
}

export async function runBenchmarks(recordCount = 20000) {
  console.log('\n🚀  Stream Performance Benchmarks')
  console.log(`\n⏳  Generating ${recordCount.toLocaleString()} records`)
  const data = generateFixtureData(recordCount)
  global.gc?.() // force garbage collection after data generation

  setupBenchmarks(data as readonly FixtureModel[])
  console.log('🏃  Running benchmarks...\n')
  await mitataRun({ colors: true })

  console.log(`\n∑ Total length of all names: ${nameCount.toLocaleString()}`)
}

// Run benchmarks if this file is executed directly
if (import.meta.main) {
  // Check for command line argument for record count
  const args = process.argv.slice(2)
  const recordCount = args[0] ? parseInt(args[0], 10) : 20000

  if (Number.isNaN(recordCount) || recordCount <= 0) {
    console.error('Error: Record count must be a positive integer')
    console.error('Usage: bun bench/bench.ts [recordCount]')
    console.error('Example: bun bench/bench.ts 5000')
    process.exit(1)
  }

  runBenchmarks(recordCount).catch(console.error)
}

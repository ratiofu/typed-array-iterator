#!/usr/bin/env bun

import { randEmail, randFirstName, randFullName, randLastName } from '@ngneat/falso'
import type { FixtureModel } from './benchmark/FixtureModel'
import type { TypedArray } from './TypedArray'

/**
 * Generates test fixture data following the format from fixtures/response.json
 */
function generateDiverseName(): string {
  // 70% chance to use randFullName (already very diverse)
  // 30% chance to combine randFirstName + randLastName for extra variety
  if (Math.random() < 0.7) {
    return randFullName()
  }
  return `${randFirstName()} ${randLastName()}`
}

/**
 * Generates fixture data as in-memory data structure
 * @param count Number of records to generate
 * @returns Fixture object with fields and data arrays
 */
export function generateFixtureData(count: number): TypedArray<FixtureModel> {
  if (Number.isNaN(count) || count <= 0) {
    throw new Error('Count must be a positive integer')
  }

  // Generate the data array efficiently
  const data: (keyof FixtureModel)[][] = []

  for (let i = 0; i < count; i++) {
    data.push([
      1000 + i, // Simple incremental ID starting from 1000
      generateDiverseName(),
      randEmail(),
    ])
  }

  // Create the fixture object following the exact format from response.json
  return {
    fields: ['id', 'name', 'emailAddress'] as const,
    data: data,
  }
}

/**
 * CLI script functionality
 */
function main() {
  // Get the count parameter from command line arguments
  const args = process.argv.slice(2)

  if (args.length !== 1) {
    console.error('Usage: bun generate-fixtures <count>')
    console.error('Example: bun generate-fixtures 100')
    process.exit(1)
  }

  const count = parseInt(args[0] ?? '0', 10)

  if (Number.isNaN(count) || count <= 0) {
    console.error('Error: Count must be a positive integer')
    process.exit(1)
  }

  try {
    const fixture = generateFixtureData(count)
    console.log(JSON.stringify(fixture, null, 2))
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

// Run the script only when called directly
if (import.meta.main) {
  main()
}

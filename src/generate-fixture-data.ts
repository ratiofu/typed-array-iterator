#!/usr/bin/env bun

import { randEmail, randFirstName, randFullName, randLastName } from '@ngneat/falso'

/**
 * Generates test fixture JSON content following the format from fixtures/small.json
 * Usage: bun generate-fixtures <count>
 * Example: bun generate-fixtures 100
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

  // Function to generate diverse names with extra CJK representation
  function generateDiverseName(): string {
    // 70% chance to use randFullName (already very diverse)
    // 30% chance to combine randFirstName + randLastName for extra variety
    if (Math.random() < 0.7) {
      return randFullName()
    }
    return `${randFirstName()} ${randLastName()}`
  }

  // Generate the data array efficiently
  const data: [number, string, string][] = []

  for (let i = 0; i < count; i++) {
    data.push([
      1000 + i, // Simple incremental ID starting from 1000
      generateDiverseName(),
      randEmail(),
    ])
  }

  // Create the fixture object following the exact format from small.json
  const fixture = {
    fields: ['id', 'name', 'emailAddress'],
    data: data,
  }

  // Output JSON to stdout efficiently
  console.log(JSON.stringify(fixture, null, 2))
}

// Run the script
main()

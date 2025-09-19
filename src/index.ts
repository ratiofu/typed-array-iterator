import type { FixtureModel } from './benchmark/FixtureModel'
import small from './fixtures/response.json'
import type { TypedArray } from './TypedArray'
import { TypedArrayProxy } from './TypedArrayProxy'

// Create iterator from the actual response
const users = new TypedArrayProxy<FixtureModel>(small as TypedArray<FixtureModel>)

console.log('=== Real data example ===')

// Use in for...of loop - this is the main requirement
if (users.length < 50) {
  for (const user of users) {
    console.log(`Processing user: ${user.name} (ID: ${user.id}, Email: ${user.emailAddress})`)
  }
}

// Efficient filtering with materialized results
console.log('\n=== Efficient filtering ===')
const usersWithLongNames = users.filter((user) => user.name.length > 4)
console.log(
  'Users with names longer than 4 chars:',
  usersWithLongNames.map((u) => u.name)
)

// Direct access with materialized copies
console.log('\n=== Direct access ===')
const firstUser = users.at(0)
const secondUser = users.at(0)
console.log('First user:', firstUser?.name)
console.log('Same data?', JSON.stringify(firstUser) === JSON.stringify(secondUser)) // true - same data
console.log('Same object?', firstUser === secondUser) // false - materialized copies

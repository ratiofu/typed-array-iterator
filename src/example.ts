import type { TypedArray } from './TypedArray'
import { TypedArrayProxy } from './TypedArrayProxy'

interface UserData extends Record<string, unknown> {
  id: number
  name: string
  emailAddress: string | null
}

// presume this was received via a `fetch` call or by some other remote means
// this is an alternative way of representing JSON data without repeating the property names
const restResponse: TypedArray<UserData> = {
  fields: ['id', 'name', 'emailAddress'],
  data: [
    [1234, 'David Röhn', null],
    [1235, 'Alex Norquist', 'an@example.com'],
    // thousands, tens of thousands, or even hundreds of thousands of records
  ],
}

// allocates a tiny amount of memory to set up the proxy
const proxy = new TypedArrayProxy(restResponse)

// no further allocations while looping
for (const user of proxy) {
  // process/render immediately - don't store references
  console.log(`rendering: ${user.name} (ID: ${user.id}, Email: ${user.emailAddress})`)
}

// TODO: Generator interface
// const names = proxy.map((user) => user.name)
// console.log('names:', names)

// or, for rendering components in a framework like React
// return proxy.map((user) => <Component user={user} />)

const nameQuery = /röh/i
const nameMatcher = (user: UserData) => nameQuery.test(user.name)

// no further allocations while filtering
for (const user of proxy.filteredIterator(nameMatcher)) {
  // process/render immediately - don't store references
  console.log(`found: ${user.name} (ID: ${user.id}, Email: ${user.emailAddress})`)
}

// only allocates results in the result array
const matches = proxy.filter(nameMatcher)
console.log('result:', matches)

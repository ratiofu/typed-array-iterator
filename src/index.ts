import { stream } from './Stream'

interface UserData extends Record<string, unknown> {
  id: number
  name: string
  emailAddress: string | null
}

// presume this was received via a `fetch` call or by some other remote means
// this is an alternative way of representing JSON data without repeating the property names
const data: readonly UserData[] = [
  { id: 1234, name: 'Dawid', emailAddress: 'dr@example.com' },
  { id: 1235, name: 'Alex', emailAddress: null },
]

// no further allocations while mapping
const allNames = stream(data).map((user) => user.name)
console.log('names:', allNames.toArray())

// or, for rendering components in a framework like React
// return proxy.map((user) => <Component user={user} />)

const nameQuery = /röh/i
const nameMatcher = (user: UserData) => nameQuery.test(user.name)

// no further allocations while filtering
for (const user of stream(data).filter(nameMatcher)) {
  console.log(`found: ${user.name} (ID: ${user.id}, Email: ${user.emailAddress})`)
}

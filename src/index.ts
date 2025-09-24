import { stream } from './Stream'

interface UserData extends Record<string, unknown> {
  id: number
  name: string
  emailAddress: string | null
}

// presume this was received via a `fetch` call or by some other remote means
// this is an alternative way of representing JSON data without repeating the property names
const data: readonly UserData[] = [
  { id: 1234, name: 'Dawid Röhn', emailAddress: 'dr@example.com' },
  { id: 1235, name: 'Alex Rühn', emailAddress: null },
]

// no further allocations while mapping
const allNames = stream(data).transform((user) => user.name)
console.log('names:', allNames.toArray())

// or, for rendering components in a framework like React
// return proxy.transform((user) => <Component user={user} />)

// no further allocations while filtering
for (const user of stream(data).filterText('röhn', 'name', 'emailAddress').toArray()) {
  console.log(`found: ${user.name} (ID: ${user.id}, Email: ${user.emailAddress})`)
}
